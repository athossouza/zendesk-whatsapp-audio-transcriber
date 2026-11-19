import { config, z } from 'zod';

/*
 * MV3 extensions cannot generate code at runtime. Without this, Zod probes
 * `Function('')` when the first object schema is created, which Chrome blocks
 * and reports as an extension error (seen on chrome://extensions). Must run
 * before any schema is built, so every module imports `z` from here.
 */
config({ jitless: true });

export { z };
