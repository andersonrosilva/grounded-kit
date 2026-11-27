/**
 * [Passo 4 · Tracer mínimo] Interface de tracing (definida em core/types) + duas implementações.
 * Cumpre: ADR-007, CR-04. Regra da session: 12 — NUNCA registrar conteúdo de prompts/respostas por padrão.
 *
 * Treino:
 *  - `createNoopTracer`: não faz nada (é o padrão do pipeline).
 *  - `createConsoleTracer`: escreve uma linha estruturada (JSON) por evento via `log` (padrão: `console.log`).
 *    Filtre/ignore chaves que carreguem conteúdo (ex.: `prompt`, `text`, `output`) — o tracer é a última barreira.
 */
import type { Tracer } from '../core/types';

/** Nomes de evento usados pelo pipeline (sugestão; mantenha em sincronia com o pipeline). */
export type TraceEventName =
  | 'pipeline.start'
  | 'guardrail.pre'
  | 'retrieve.done'
  | 'generate.attempt'
  | 'validate.failed'
  | 'guardrail.post'
  | 'pipeline.end';

export interface ConsoleTracerOptions {
  log?: (line: string) => void;
}

/** Chaves que carregam conteúdo (prompt, resposta, mensagens): nunca saem do tracer (regra 12). */
const CONTENT_KEYS: ReadonlySet<string> = new Set(['prompt', 'text', 'output', 'system', 'errors']);

export function createNoopTracer(): Tracer {
  return {
    event() {},
  };
}

export function createConsoleTracer(options?: ConsoleTracerOptions): Tracer {
  const log = options?.log ?? console.log;

  return {
    event(name, data) {
      const safe: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (!CONTENT_KEYS.has(key)) {
          safe[key] = value;
        }
      }
      log(JSON.stringify({ event: name, ...safe }));
    },
  };
}
