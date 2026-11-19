import { findPreset, WASM_FALLBACK_MODEL, type Device, type Dtype } from './models';

export interface GpuInfo {
  webgpu: boolean;
  shaderF16: boolean;
}

export interface EngineRequest {
  model: string;
  /** Force a device; `auto` follows spec section 7. */
  device?: Device | 'auto';
  /** Force a dtype (benchmarks); otherwise taken from the model preset. */
  dtype?: Dtype;
}

export interface EngineChoice {
  model: string;
  device: Device;
  dtype: Dtype;
  /** True when the requested model was swapped for the lighter WASM one. */
  downgraded: boolean;
}

/**
 * Picks device, dtype and model (spec section 7, "Escolha do backend").
 * Forcing `device: 'wasm'` keeps the requested model (benchmarks);
 * `auto` without WebGPU swaps to the lighter fallback model.
 */
export function chooseEngine(req: EngineRequest, gpu: GpuInfo): EngineChoice {
  const wanted = req.device ?? 'auto';
  const device: Device = wanted === 'auto' ? (gpu.webgpu ? 'webgpu' : 'wasm') : wanted;
  const requestedMb = findPreset(req.model)?.approxMb ?? Infinity;
  const fallbackMb = findPreset(WASM_FALLBACK_MODEL)?.approxMb ?? 0;
  // Only swap models that are heavier than the WASM fallback.
  const downgraded = wanted === 'auto' && device === 'wasm' && requestedMb > fallbackMb;
  const model = downgraded ? WASM_FALLBACK_MODEL : req.model;
  const preset = findPreset(model);

  let dtype: Dtype;
  if (req.dtype) dtype = req.dtype;
  else if (!preset) dtype = device === 'webgpu' && gpu.shaderF16 ? 'fp16' : 'q8';
  else if (device === 'wasm') dtype = preset.wasm;
  else dtype = gpu.shaderF16 ? preset.webgpuF16 : preset.webgpu;

  return { model, device, dtype, downgraded };
}

export function describeDtype(dtype: Dtype): string {
  return typeof dtype === 'string'
    ? dtype
    : `enc:${dtype.encoder_model}/dec:${dtype.decoder_model_merged}`;
}

/** Feature-detects WebGPU and `shader-f16` (works in windows and workers). */
export async function detectGpu(nav: Navigator | WorkerNavigator = navigator): Promise<GpuInfo> {
  const gpu = (nav as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) return { webgpu: false, shaderF16: false };
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return { webgpu: false, shaderF16: false };
    return { webgpu: true, shaderF16: adapter.features.has('shader-f16') };
  } catch {
    return { webgpu: false, shaderF16: false };
  }
}
