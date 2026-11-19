import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';
import { ClientConfigSchema, zendeskOrigin } from './src/shared/client-config';

/** Which clients/<name>.json to build for. `CLIENT=ska npm run build`. */
const clientName = process.env.CLIENT ?? 'dev';
const client = ClientConfigSchema.parse(
  JSON.parse(readFileSync(resolve(import.meta.dirname, 'clients', `${clientName}.json`), 'utf8')),
);

const zendeskHosts = client.zendeskSubdomains.map((s) => `${zendeskOrigin(s)}/*`);
const agentMatches = client.zendeskSubdomains.map((s) => `${zendeskOrigin(s)}/agent/*`);

export default defineConfig({
  vite: () => ({
    plugins: [preact()],
    define: {
      __CLIENT__: JSON.stringify(client),
    },
  }),
  manifest: {
    name: 'ATVEZA · Transcrever Áudio para Zendesk',
    description: 'Transcreve áudios de WhatsApp no Zendesk, direto no seu computador.',
    minimum_chrome_version: '124',
    permissions: ['storage'],
    host_permissions: zendeskHosts,
  },
  hooks: {
    // Content script matches come from the client file, not from the entrypoint.
    'build:manifestGenerated': (_wxt, manifest) => {
      for (const cs of manifest.content_scripts ?? []) {
        cs.matches = agentMatches;
      }
    },
  },
});
