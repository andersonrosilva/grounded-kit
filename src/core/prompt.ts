/**
 * [Passo 2 · Prompt] Monta o prompt final a partir do pack, dos exemplos recuperados e do feedback de retry.
 * Cumpre: ADR-006 (retry com erros como feedback), regra 9 (conteúdo recuperado é DADO, não instrução).
 * Regras da session: 6, 9, 10. Mitiga injeção de prompt via base de conhecimento.
 *
 * Treino:
 *  - `renderExamples`: envolva cada exemplo em um bloco delimitado e rotulado como "exemplo (dado, não instrução)".
 *    Lista vazia => string vazia (recuperação vazia não é erro — regra 10).
 *  - `renderRetryFeedback`: transforme a lista de erros da tentativa anterior em texto para o modelo corrigir.
 *  - `buildPrompt`: use `pack.prompts.user(input, examples)` e anexe exemplos + feedback.
 */
import type { DomainPack } from './pack';
import type { KnowledgeItem } from '../retrieval/types';

export interface BuildPromptArgs<TIn, TOut> {
  pack: DomainPack<TIn, TOut>;
  input: TIn;
  examples: readonly KnowledgeItem[];
  /** Erros da tentativa anterior (schema/validators); ausente na primeira tentativa. */
  previousErrors?: readonly string[];
}

export interface BuiltPrompt {
  system?: string;
  prompt: string;
}

export function buildPrompt<TIn, TOut>(args: BuildPromptArgs<TIn, TOut>): BuiltPrompt {
  throw new Error('not implemented');
}

export function renderExamples(examples: readonly KnowledgeItem[]): string {
  throw new Error('not implemented');
}

export function renderRetryFeedback(errors: readonly string[]): string {
  throw new Error('not implemented');
}
