import { z } from './zod';

/** Error codes (spec section 12). */
export const ErrorCodeSchema = z.enum([
  'AUDIO_FETCH_FAILED',
  'AUDIO_TOO_LONG',
  'AUDIO_UNSUPPORTED_FORMAT',
  'MODEL_DOWNLOAD_FAILED',
  'STORAGE_QUOTA',
  'GPU_LOST',
  'TRANSCRIBE_FAILED',
  'NO_SPEECH',
  'CANCELLED',
  'QUEUE_FULL',
  'NOTE_SAVE_FAILED',
  'SELECTORS_INVALID',
  'EXTENSION_UPDATED',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export class TranscriberError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'TranscriberError';
  }
}

/** Message shown to the agent, in Portuguese (spec section 12). `null` = show nothing. */
export function errorMessage(
  code: ErrorCode,
  params: { maxMinutes?: number; mime?: string } = {},
): string | null {
  switch (code) {
    case 'AUDIO_FETCH_FAILED':
      return 'Não consegui acessar este áudio. Recarregue o ticket e tente de novo.';
    case 'AUDIO_TOO_LONG':
      return `Áudio longo demais para transcrever aqui (máx. ${params.maxMinutes ?? 10} min).`;
    case 'AUDIO_UNSUPPORTED_FORMAT':
      return `Formato de áudio não suportado (${params.mime || 'desconhecido'}).`;
    case 'MODEL_DOWNLOAD_FAILED':
      return 'Não consegui baixar o modelo de IA. Verifique a internet ou fale com o TI (domínio huggingface.co).';
    case 'STORAGE_QUOTA':
      return 'Sem espaço no navegador para o modelo. Libere espaço ou escolha um modelo menor.';
    case 'TRANSCRIBE_FAILED':
    case 'GPU_LOST':
      return 'A transcrição falhou. Tente de novo.';
    case 'NO_SPEECH':
      return 'Não foi possível identificar fala neste áudio.';
    case 'QUEUE_FULL':
      return 'Aguarde as transcrições em andamento.';
    case 'NOTE_SAVE_FAILED':
      return 'Não foi possível salvar a nota.';
    case 'EXTENSION_UPDATED':
      return 'A extensão foi atualizada. Recarregue a página.';
    case 'CANCELLED':
    case 'SELECTORS_INVALID':
      return null;
  }
}

/** Maps a raw inference/loading error to a code. */
export function classifyError(err: unknown): ErrorCode {
  if (err instanceof TranscriberError) return err.code;
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (/QuotaExceeded|quota/i.test(text)) return 'STORAGE_QUOTA';
  if (/device (was )?lost|GPUDevice|webgpu.*(lost|destroy)/i.test(text)) return 'GPU_LOST';
  if (/fetch|network|Failed to load|HTTP|404|403|Could not locate file/i.test(text))
    return 'MODEL_DOWNLOAD_FAILED';
  return 'TRANSCRIBE_FAILED';
}
