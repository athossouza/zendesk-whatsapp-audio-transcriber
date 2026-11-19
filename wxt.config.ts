import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'wxt';
import { ClientConfigSchema, zendeskOrigin } from './src/shared/client-config';

/** Which clients/<name>.json to build for. `CLIENT=ska npm run build`. */
const clientName = process.env.CLIENT ?? 'dev';
const client = ClientConfigSchema.parse(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'clients', `${clientName}.json`), 'utf8')),
);

const zendeskHosts = client.zendeskSubdomains.map((s) => `${zendeskOrigin(s)}/*`);
const agentMatches = client.zendeskSubdomains.map((s) => `${zendeskOrigin(s)}/agent/*`);

/** ONNX Runtime WASM shipped inside the package (no remote code in MV3). */
const ORT_DIST = resolve(import.meta.dirname, 'node_modules/onnxruntime-web/dist');
const ORT_FILES = ['ort-wasm-simd-threaded.asyncify.wasm', 'ort-wasm-simd-threaded.asyncify.mjs'];

export default defineConfig({
  vite: () => ({
    plugins: [preact()],
    resolve: {
      // Use ONNX Runtime's non-bundled build: it loads its WASM factory from
      // public/ort (wasmPaths) instead of Vite emitting a second 27 MB copy.
      conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
    },
    define: {
      __CLIENT__: JSON.stringify(client),
    },
  }),
  manifest: {
    name: 'ATVEZA · Transcrever Áudio para Zendesk',
    description: 'Transcreve áudios de WhatsApp no Zendesk, direto no seu computador.',
    minimum_chrome_version: '124',
    permissions: ['storage', 'offscreen'],
    host_permissions: [
      ...zendeskHosts,
      // Model download (spec section 10). The Hub redirects to *.hf.co CDNs.
      'https://huggingface.co/*',
      'https://*.huggingface.co/*',
      'https://*.hf.co/*',
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    // Cross-origin isolation enables multi-threaded WASM (SharedArrayBuffer).
    cross_origin_embedder_policy: { value: 'require-corp' },
    cross_origin_opener_policy: { value: 'same-origin' },
  },
  hooks: {
    'build:publicAssets': (_wxt, files) => {
      for (const name of ORT_FILES) {
        files.push({ absoluteSrc: resolve(ORT_DIST, name), relativeDest: `ort/${name}` });
      }
    },
    // Content script matches come from the client file, not from the entrypoint.
    'build:manifestGenerated': (_wxt, manifest) => {
      for (const cs of manifest.content_scripts ?? []) {
        cs.matches = agentMatches;
      }
    },
  },
});
