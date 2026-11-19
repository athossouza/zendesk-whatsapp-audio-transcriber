import { errorMessage } from './errors';
import type { Progress, TranscriptResult } from './messages';

/** UI state of one transcription (spec section 3, "Estados da caixa"). */
export type TranscriptionState =
  | { kind: 'idle' }
  | { kind: 'downloading'; loadedBytes: number; totalBytes: number }
  | { kind: 'queued' }
  | { kind: 'decoding' }
  | { kind: 'loading-model'; downgraded: boolean }
  | { kind: 'transcribing'; text: string }
  | { kind: 'done'; result: TranscriptResult }
  | { kind: 'error'; message: string };

export function reduceProgress(state: TranscriptionState, p: Progress): TranscriptionState {
  switch (p.type) {
    case 'MODEL_PROGRESS':
      // Progress also fires while reading from cache; only show it when bytes really move.
      return { kind: 'downloading', loadedBytes: p.loadedBytes, totalBytes: p.totalBytes };
    case 'STAGE':
      if (p.stage === 'transcribing') return { kind: 'transcribing', text: '' };
      if (p.stage === 'loading-model') return { kind: 'loading-model', downgraded: !!p.downgraded };
      return { kind: p.stage };
    case 'PARTIAL':
      return { kind: 'transcribing', text: p.text };
    case 'DONE':
      return p.result.text
        ? { kind: 'done', result: p.result }
        : { kind: 'error', message: errorMessage('NO_SPEECH') ?? '' };
    case 'ERROR': {
      const message = errorMessage(p.code, { mime: p.detail });
      return message ? { kind: 'error', message } : { kind: 'idle' };
    }
  }
}

export function stateLabel(state: TranscriptionState): string {
  switch (state.kind) {
    case 'downloading':
      return 'Preparando a transcrição (só na primeira vez)';
    case 'queued':
      return 'Aguardando outra transcrição terminar';
    case 'decoding':
      return 'Lendo o áudio';
    case 'loading-model':
      return state.downgraded
        ? 'Seu computador não tem aceleração de vídeo; usando modelo mais leve.'
        : 'Carregando o modelo';
    case 'transcribing':
      return 'Transcrevendo';
    case 'done':
      return 'Concluído';
    case 'error':
      return state.message;
    case 'idle':
      return '';
  }
}
