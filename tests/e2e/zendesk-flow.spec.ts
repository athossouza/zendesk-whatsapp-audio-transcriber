import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixtures';

const ROOT = resolve(import.meta.dirname, '../..');
// Any account works with the store build: use a made-up subdomain.
const ORIGIN = 'https://acme-teste.zendesk.com';
const fixture = readFileSync(resolve(ROOT, 'tests/fixtures/zendesk-ticket.html'), 'utf8')
  // Real audio served by the mocked Zendesk instead of a blob: URL.
  .replace(/blob:https:\/\/d3v-atveza\.zendesk\.com\/[0-9a-f-]+/g, `${ORIGIN}/fake/audio.ogg`);
const audio = readFileSync(resolve(ROOT, 'public/samples/teste-ptbr.ogg'));

/**
 * Spec section 13: full flow on a page that imitates the Agent Workspace,
 * with the Zendesk API mocked. Uses whatever model the options select (default
 * turbo on WebGPU, small on WASM in headless runs without GPU).
 */
test('⋯ → Transcrever → Salvar como nota interna', async ({ context, extensionId }) => {
  expect(extensionId).toBeTruthy(); // fixture resets extension state
  const notes: unknown[] = [];
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/agent/tickets/454') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta name="csrf-token" content="meta-token"><style>/* Like the real Agent Workspace: fixed-height rows that clip their content. */ [data-test-id="omni-log-container"]{height:600px;overflow:hidden auto} article{display:block;height:180px;overflow:hidden}</style></head><body>${fixture}</body></html>`,
      });
    }
    if (url.pathname === '/fake/audio.ogg') {
      return route.fulfill({ contentType: 'audio/ogg', body: audio });
    }
    if (url.pathname === '/api/v2/users/me.json') {
      return route.fulfill({ json: { user: { authenticity_token: 'csrf-1' } } });
    }
    if (url.pathname === '/api/v2/tickets/454/comments.json') {
      return route.fulfill({ json: { comments: [], meta: { has_more: false } } });
    }
    if (url.pathname === '/api/v2/tickets/454.json' && route.request().method() === 'PUT') {
      expect(route.request().headers()['x-csrf-token']).toBe('csrf-1');
      notes.push(route.request().postDataJSON());
      return route.fulfill({ json: { ticket: { id: 454 } } });
    }
    return route.fulfill({ status: 404, body: '' });
  });

  const page = await context.newPage();
  // Errors that chrome://extensions would list (e.g. CSP blocking eval/new Function).
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || /Refused to evaluate|unsafe-eval/i.test(m.text())) {
      pageErrors.push(m.text());
    }
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${ORIGIN}/agent/tickets/454`);

  // One ⋯ per audio (2 in the fixture), no duplicates after re-scans.
  const more = page.getByRole('button', { name: 'Mais ações do áudio' });
  await expect(more).toHaveCount(2);
  await page.evaluate(() => document.body.appendChild(document.createElement('div')));
  await page.waitForTimeout(600);
  await expect(more).toHaveCount(2);

  await more.first().click();
  const transcribeItem = page.getByRole('menuitem', { name: 'Transcrever' });
  await expect(transcribeItem).toBeVisible();
  await page.screenshot({ path: 'test-results/ui-menu.png' });
  await transcribeItem.click();

  const dialog = page.getByRole('dialog', { name: 'Transcrição do áudio' });
  await expect(dialog).toBeVisible();
  const save = dialog.getByRole('button', { name: 'Salvar como nota interna' });
  await expect(save).toBeVisible({ timeout: 90 * 1000 });
  const text = await dialog.locator('.body').innerText();
  console.log('TRANSCRIPT:', text);
  expect(text.toLowerCase()).toContain('licença');

  await page.screenshot({ path: 'test-results/ui-panel.png' });
  await save.click();
  await expect(dialog.getByText('Salva no ticket')).toBeVisible();
  await page.screenshot({ path: 'test-results/ui-saved.png' });
  expect(notes).toHaveLength(1);
  const comment = (notes[0] as { ticket: { comment: { body: string; public: boolean } } }).ticket
    .comment;
  expect(comment.public).toBe(false);
  expect(comment.body).toMatch(/^Transcrição do áudio de Cliente Teste/);
  expect(comment.body).toMatch(/\[atveza-transcricao:[a-f0-9]{32}\]$/);

  // Link box ↔ audio: header names the source and an outline marks the audio.
  await expect(dialog.locator('header')).toContainText('Cliente Teste');
  const ring = page.locator('.source-ring');
  await expect(ring).toBeVisible();
  const player = (await page
    .locator('[data-test-id="audio-player-container"]')
    .first()
    .boundingBox())!;
  const ringBox = (await ring.boundingBox())!;
  expect(Math.round(ringBox.x)).toBe(Math.round(player.x - 4));
  await expect(dialog.getByRole('button', { name: 'Mostrar o áudio na conversa' })).toBeVisible();

  // Drag by the header: the box moves and stays where it was dropped.
  const before = (await dialog.boundingBox())!;
  const head = dialog.locator('header');
  const hb = (await head.boundingBox())!;
  await page.mouse.move(hb.x + 40, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 240, hb.y + hb.height / 2 + 120, { steps: 5 });
  await page.mouse.up();
  const moved = (await dialog.boundingBox())!;
  expect(Math.round(moved.x - before.x)).toBe(200);
  expect(Math.round(moved.y - before.y)).toBe(120);

  // Resize from the corner grip; the size is remembered for the next box.
  const grip = (await dialog.locator('.resizer').boundingBox())!;
  await page.mouse.move(grip.x + 8, grip.y + 8);
  await page.mouse.down();
  await page.mouse.move(grip.x + 68, grip.y + 108, { steps: 5 });
  await page.mouse.up();
  const resized = (await dialog.boundingBox())!;
  expect(Math.round(resized.width - moved.width)).toBe(60);
  expect(Math.round(resized.height - moved.height)).toBe(100);
  // After moving, the outline still marks the source audio.
  await expect(ring).toBeVisible();
  await page.screenshot({ path: 'test-results/ui-moved.png' });

  // Esc closes and returns focus to ⋯; reopening shows the cached transcript.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await more.first().click();
  await page.getByRole('menuitem', { name: 'Ver transcrição' }).click();
  // Reopened next to the audio (position not kept), with the remembered size.
  const reopened = (await dialog.boundingBox())!;
  expect(Math.round(reopened.width)).toBe(Math.round(resized.width));
  expect(Math.abs(reopened.x - before.x)).toBeLessThan(2);
  expect(pageErrors.filter((e) => !/favicon|404/.test(e))).toEqual([]);
});
