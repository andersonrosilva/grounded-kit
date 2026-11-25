/**
 * [Passo 2 · Guardrails] Executa os guardrails do pack por estágio (`pre` | `post`).
 * Cumpre: ADR-002 (a política é do pack; aqui só há o ponto de encaixe), CR-02.
 * Regras da session: 2, 3, 7, 8.
 *
 * Treino de `runGuardrails`:
 *  - filtre `guardrails` pelo `stage` pedido e rode em ordem;
 *  - primeiro `block` interrompe e devolve `{ action: 'block', reason, guardrailId }` (sem conteúdo parcial);
 *  - `modify` substitui o output para os guardrails seguintes e é reportado ao final;
 *  - nenhum guardrail => `{ action: 'allow' }`.
 * O pipeline é quem REVALIDA o resultado de `modify` (regra 8).
 */
import type { Guardrail, GuardrailContext, GuardrailStage } from '../core/types';

export type GuardrailRun =
  | { action: 'allow' }
  | { action: 'block'; reason: string; guardrailId: string }
  | { action: 'modify'; output: unknown; guardrailId: string };

export function runGuardrails<TIn, TOut>(
  guardrails: readonly Guardrail<TIn, TOut>[] | undefined,
  stage: GuardrailStage,
  ctx: GuardrailContext<TIn, TOut>,
): Promise<GuardrailRun> {
  throw new Error('not implemented');
}
