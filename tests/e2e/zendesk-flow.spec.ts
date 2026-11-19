import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from './fixtures';

const ROOT = resolve(import.meta.dirname, '../..');
const ORIGIN = 'https://d3v-atveza.zendesk.com';
const fixture = readFileSync(resolve(ROOT, 'tests/fixtures/zendesk-ticket.html'), 'utf8')
  // Real audio served by the mocked Zendesk instead of a blob: URL.
  .replace(/blob:https:\/\/d3v-atveza\.zendesk\.com\/[0-9a-f-]+/g, `${ORIGIN}/fake/audio.ogg`);
const audio = readFileSync(resolve(ROOT, 'public/samples/teste-ptbr.ogg'));

/**
 * Spec section 13: full flow on a page that imitates the Agent Workspace,
 * with the Zendesk API mocked. Uses whatever model the options select (default
 * turbo on WebGPU, small on WASM in headless runs without GPU).
 */
test('⋯ → Transcrever → Salvar como nota interna', async ({ context }) => {
  const notes: unknown[] = [];
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/agent/tickets/454') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta name="csrf-token" content="meta-token"></head><body>${fixture}</body></html>`,
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
  page.on('console', (m) => console.log('PAGE', m.type(), m.text()));
  for (const w of context.serviceWorkers()) w.on('console', (m) => console.log('SW', m.text()));
  await page.goto(`${ORIGIN}/agent/tickets/454`);

  // One ⋯ per audio (2 in the fixture), no duplicates after re-scans.
  const more = page.getByRole('button', { name: 'Mais ações do áudio' });
  await expect(more).toHaveCount(2);
  await page.evaluate(() => document.body.appendChild(document.createElement('div')));
  await page.waitForTimeout(600);
  await expect(more).toHaveCount(2);

  await more.first().click();
  await page.getByRole('menuitem', { name: 'Transcrever' }).click();

  const dialog = page.getByRole('dialog', { name: 'Transcrição do áudio' });
  await expect(dialog).toBeVisible();
  const save = dialog.getByRole('button', { name: 'Salvar como nota interna' });
  await expect(save).toBeVisible({ timeout: 90 * 1000 });
  const text = await dialog.locator('.body').innerText();
  console.log('TRANSCRIPT:', text);
  expect(text.toLowerCase()).toContain('licença');

  await save.click();
  await expect(dialog.getByText('Salva no ticket')).toBeVisible();
  expect(notes).toHaveLength(1);
  const comment = (notes[0] as { ticket: { comment: { body: string; public: boolean } } }).ticket
    .comment;
  expect(comment.public).toBe(false);
  expect(comment.body).toMatch(/^Transcrição do áudio de Cliente Teste/);
  expect(comment.body).toMatch(/\[atveza-transcricao:[a-f0-9]{32}\]$/);

  // Esc closes and returns focus to ⋯; reopening shows the cached transcript.
  console.log('ACTIVE:', await page.evaluate(() => {
    const a = document.activeElement;
    const inner = (a as HTMLElement | null)?.shadowRoot?.activeElement;
    return `${a?.tagName} > ${inner?.tagName ?? '-'} ${inner?.textContent ?? ''}`;
  }));
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await more.first().click();
  await expect(page.getByRole('menuitem', { name: 'Ver transcrição' })).toBeVisible();
});
