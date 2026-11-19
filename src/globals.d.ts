import type { ClientConfig } from './shared/client-config';

declare global {
  /** Injected at build time from clients/<client>.json (see wxt.config.ts). */
  const __CLIENT__: ClientConfig;
}

export {};
