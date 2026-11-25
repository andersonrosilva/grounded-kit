/**
 * [Passo 1 · Tipos e contratos] Contratos (ports) e tipos compartilhados do core.
 * Cumpre: ADR-001 (motor × domínio), ADR-002 (Guardrail ≠ Validator), ADR-006 (RunResult).
 * Regras da session: 3, 4, 7, 8. CR-01: nada aqui pode mencionar um domínio específico.
 * Os ports `Embeddings` e `VectorStore` ficam em `../retrieval/types`.
 *
 * Aqui só há tipos: não há corpo para implementar. Leia, ajuste se discordar e siga para `pack.ts`.
 */
import type { ZodType } from 'zod';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

// ---------- Provider (ADR-008) ----------

export interface GenerateRequest {
  system?: string;
  prompt: string;
  /** Schema Zod; o adaptador o converte para o formato nativo quando o provider suporta. */
  schema?: ZodType;
  temperature?: number;
  signal?: AbortSignal;
}

export interface GenerateResult {
  /** Texto bruto devolvido pelo modelo; o pipeline faz o parse (nunca por regex — CR-03). */
  text: string;
  /** Preenchido quando o adaptador já devolve objeto. */
  data?: unknown;
  usage: Usage;
}

export interface Provider {
  readonly id: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

// ---------- Guardrail = política (ADR-002) ----------

export type GuardrailStage = 'pre' | 'post';

export type GuardrailVerdict =
  | { action: 'allow' }
  | { action: 'block'; reason: string }
  | { action: 'modify'; output: unknown; reason?: string };

export interface GuardrailContext<TIn = unknown, TOut = unknown> {
  input: TIn;
  /** Só existe no estágio `post`. */
  output?: TOut;
}

export interface Guardrail<TIn = unknown, TOut = unknown> {
  readonly id: string;
  readonly stage: GuardrailStage;
  check(ctx: GuardrailContext<TIn, TOut>): Promise<GuardrailVerdict>;
}

// ---------- Validator = fato verificável por dado (ADR-002) ----------

export type ValidationResult = { ok: true } | { ok: false; error: string };

export interface Validator<TOut = unknown> {
  readonly id: string;
  validate(output: TOut): ValidationResult;
}

// ---------- Tracer (ADR-007) ----------

export interface Tracer {
  /** Por padrão NÃO recebe conteúdo de prompts/respostas (CR-04). */
  event(name: string, data: Record<string, unknown>): void;
}

// ---------- Resultado do pipeline (ADR-006) ----------

export type RunResult<TOut> =
  | { status: 'ok'; data: TOut; usage: Usage }
  | { status: 'blocked'; reason: string; guardrailId: string }
  | { status: 'invalid'; errors: string[]; attempts: number };

/** Schema Zod de saída de um pack (ADR-003). */
export type OutputSchema<TOut> = ZodType<TOut>;
