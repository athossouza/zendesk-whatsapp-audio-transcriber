/** Cache Storage bucket used by Transformers.js for model files. */
const TRANSFORMERS_CACHE = 'transformers-cache';

export async function clearModelCache(): Promise<void> {
  await caches.delete(TRANSFORMERS_CACHE);
}

export async function modelCacheBytes(): Promise<number> {
  const estimate = await navigator.storage.estimate();
  return estimate.usage ?? 0;
}
