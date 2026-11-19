import { z } from './zod';

/**
 * Build-time client configuration (clients/<client>.json).
 * Drives host permissions, content script matches and default settings.
 */
export const ClientConfigSchema = z.object({
  name: z.string().min(1),
  zendeskSubdomains: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).min(1),
  replacements: z.array(z.object({ from: z.string().min(1), to: z.string() })).default([]),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;

export function zendeskOrigin(subdomain: string): string {
  return `https://${subdomain}.zendesk.com`;
}
