import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'wxt';
import { ClientConfigSchema, isAnyZendesk, zendeskOrigin } from './src/shared/client-config';

/** Which clients/<name>.json to build for. `CLIENT=ska npm run build`. */
const clientName = process.env.CLIENT ?? 'dev';
const client = ClientConfigSchema.parse(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'clients', `${clientName}.json`), 'utf8')),
);

// Store build (`["*"]`): any Zendesk account, but the content script only runs in the
// agent interface (/agent/*). Client builds keep their own subdomains.
const zendeskHosts = isAnyZendesk(client)
  ? ['https://*.zendesk.com/*']
  : client.zendeskSubdomains.map((s) => `${zendeskOrigin(s)}/*`);
const agentMatches = isAnyZendesk(client)
  ? ['https://*.zendesk.com/agent/*']
  : client.zendeskSubdomains.map((s) => `${zendeskOrigin(s)}/agent/*`);

/** ONNX Runtime WASM shipped inside the package (no remote code in MV3). */
const ORT_DIST = resolve(import.meta.dirname, 'node_modules/onnxruntime-web/dist');
const ORT_FILES = ['ort-wasm-simd-threaded.asyncify.wasm', 'ort-wasm-simd-threaded.asyncify.mjs'];

export default defineConfig({
  // Separate folders: e2e build (open shadow roots) and each client build never
  // overwrite the dev build loaded unpacked in Chrome (its ID depends on the path).
  outDir:
    process.env.WXT_E2E === '1'
      ? '.output-e2e'
      : clientName === 'dev'
        ? '.output'
        : `.output-${clientName}`,
  zip: {
    // e.g. zendesk-whatsapp-audio-transcriber-ska-0.2.0-chrome.zip
    artifactTemplate: `{{name}}-${clientName}-{{version}}-{{browser}}.zip`,
  },
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
    icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
    // Lets IT lock settings company-wide via Chrome policy (spec section 9).
    storage: { managed_schema: 'managed_schema.json' },
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
