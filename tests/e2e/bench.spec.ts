import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarize, type BenchRun } from '../../src/shared/bench';
import { expect, test } from './fixtures';

/**
 * Phase 1 benchmark (not part of CI). Example:
 *   BENCH=1 HEADED=1 BENCH_MODELS=onnx-community/whisper-base BENCH_DEVICES=webgpu,wasm npx playwright test bench
 */
test.skip(!process.env.BENCH, 'set BENCH=1 to run the benchmark');
test.setTimeout(60 * 60 * 1000);

test('benchmark', async ({ context, extensionId }) => {
  const page = await context.newPage();
  const models = process.env.BENCH_MODELS ?? 'onnx-community/whisper-base';
  const devices = process.env.BENCH_DEVICES ?? 'webgpu,wasm';
  await page.goto(
    `chrome-extension://${extensionId}/benchmark.html?models=${models}&devices=${devices}`,
  );
  await page.getByTestId('bench-start').click();
  await page.waitForFunction(() => window.__bench?.done === true, null, {
    timeout: 60 * 60 * 1000,
    polling: 2000,
  });
  const bench = (await page.evaluate(() => window.__bench)) as {
    runs: BenchRun[];
    gpu: unknown;
    isolated: boolean;
  };
  const summary = summarize(bench.runs);
  const dir = resolve(import.meta.dirname, '../../bench-results');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      { gpu: bench.gpu, isolated: bench.isolated, summary, runs: bench.runs },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ gpu: bench.gpu, isolated: bench.isolated, summary }, null, 2));
  expect(bench.runs.length).toBeGreaterThan(0);
});
