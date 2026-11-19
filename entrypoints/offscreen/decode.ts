import { TranscriberError } from '@/src/shared/errors';

export const SAMPLE_RATE = 16_000;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Decodes any browser-supported audio to 16 kHz mono (spec section 6).
 * OfflineAudioContext resamples to its own rate and needs no user gesture.
 */
export async function decodeTo16kMono(
  bytes: ArrayBuffer,
  mime?: string,
): Promise<{ audio: Float32Array; seconds: number }> {
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new TranscriberError('AUDIO_TOO_LONG', 'size');
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(bytes);
  } catch {
    throw new TranscriberError('AUDIO_UNSUPPORTED_FORMAT', mime ?? 'unknown');
  }
  return { audio: mixToMono(buf), seconds: buf.duration };
}

export function mixToMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice();
  const mono = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < buf.length; i++) mono[i] = (mono[i] ?? 0) + (data[i] ?? 0);
  }
  for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] ?? 0) / buf.numberOfChannels;
  return mono;
}
