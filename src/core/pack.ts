/**
 * [Passo 1 · definePack] Contrato declarativo do domain pack.
 * Cumpre: ADR-005 (objeto tipado, funções puras), ADR-001 (o core só conhece este contrato), ADR-002.
 * Regras da session: 1, 2, 9 (exemplos entram como dado), 10. CR-01, CR-02.
 *
 * Treino de `definePack`: validar a FORMA do pack na carga e lançar `PackDefinitionError` com a lista de
 * problemas (id/version vazios, `outputSchema` ausente, ids de guardrail/validator duplicados, `knowledge`
 * sem `toQuery`, etc.). Devolva o pack congelado (`Object.freeze`) como `DomainPack`.
 */
import type { Guardrail, OutputSchema, Validator } from './types';
import type { KnowledgeItem } from '../retrieval/types';

export interface PackPrompts<TIn> {
  system?: string;
  /** Monta o prompt do usuário. `examples` são dados recuperados (RAG), vazios se não houver. */
  user(input: TIn, examples: readonly KnowledgeItem[]): string;
}

export interface PackKnowledge<TIn> {
  /** Base curada do domínio; o pipeline a indexa via Embeddings + VectorStore. */
  items: readonly KnowledgeItem[];
  /** Texto usado para buscar itens similares ao pedido. */
  toQuery(input: TIn): string;
}

export interface PackDefinition<TIn, TOut> {
  id: string;
  version: string;
  prompts: PackPrompts<TIn>;
  outputSchema: OutputSchema<TOut>;
  guardrails?: readonly Guardrail<TIn, TOut>[];
  validators?: readonly Validator<TOut>[];
  knowledge?: PackKnowledge<TIn>;
}

export type DomainPack<TIn, TOut> = Readonly<PackDefinition<TIn, TOut>>;

export function definePack<TIn, TOut>(definition: PackDefinition<TIn, TOut>): DomainPack<TIn, TOut> {
  throw new Error('not implemented');
}
