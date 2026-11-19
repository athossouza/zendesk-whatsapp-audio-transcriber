import { expect, test } from './fixtures';

// Spec section 13: real transcription of the bundled sample with whisper-base on WASM.
test('options page transcribes the sample with whisper-base on WASM', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.getByLabel('Modelo').selectOption('onnx-community/whisper-base');
  await page.getByLabel('Processamento').selectOption('wasm');
  await page.getByTestId('test-start').click();

  const status = page.getByTestId('test-status');
  await expect(status).toHaveAttribute('data-state', /done|error/, { timeout: 8 * 60 * 1000 });
  expect(await status.getAttribute('data-state'), (await status.textContent()) ?? '').toBe('done');

  const text = (await page.getByTestId('test-text').textContent()) ?? '';
  console.log('TRANSCRIPT:', text);
  console.log('METRICS:', await page.getByTestId('test-metrics').innerText());
  // whisper-base is weak on technical terms (EDGECAM, dongle); check common words only.
  for (const word of ['bom dia', 'licença', 'mensagem', 'encontrado']) {
    expect(text.toLowerCase()).toContain(word);
  }
  expect(errors).toEqual([]);
});
