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

export async function runGuardrails<TIn, TOut>(
  guardrails: readonly Guardrail<TIn, TOut>[] | undefined,
  stage: GuardrailStage,
  ctx: GuardrailContext<TIn, TOut>,
): Promise<GuardrailRun> {
  const filteredGuardrails = (guardrails ?? []).filter((g) => g.stage === stage);
  //const filteredGuardrails = guardrails?.filter((g) => g.stage === stage);
  
  if (filteredGuardrails && filteredGuardrails.length === 0) {
    return { action: 'allow' };
  }

  let lastModify: GuardrailRun | null = null;
  let current = ctx;

  for (const g of filteredGuardrails ?? []) {
    const verdict = await g.check(current);
    if (verdict.action === 'block') {
      return { action: 'block', reason: verdict.reason, guardrailId: g.id };
    }
    if (verdict.action === 'modify') {
      current = { ...current, output: verdict.output as TOut };
      lastModify = { action: 'modify', output: verdict.output, guardrailId: g.id };
    }
  }

  if (lastModify) {
    return lastModify;
  }

  return { action: 'allow' };
}
