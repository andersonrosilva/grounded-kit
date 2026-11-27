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
import { PackDefinitionError } from './errors';

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
  const issues: string[] = [];

  if (!definition.id || !definition.id.trim()) {
    issues.push('id do pack é obrigatório');
  }
  if (!definition.version || !definition.version.trim()) {
    issues.push('version do pack é obrigatória');
  }
  if (!definition.outputSchema) {
    issues.push('outputSchema do pack é obrigatório');
  }
  if (!definition.prompts || typeof definition.prompts.user !== 'function') {
    issues.push('prompts.user do pack é obrigatório e deve ser uma função');
  }

  const guardrailIds = new Set<string>();
  for (const g of definition.guardrails ?? []) {
    if (guardrailIds.has(g.id)) {
      issues.push(`id de guardrail duplicado: ${g.id}`);
    }
    guardrailIds.add(g.id);
  }

  const validatorIds = new Set<string>();
  for (const v of definition.validators ?? []) {
    if (validatorIds.has(v.id)) {
      issues.push(`id de validator duplicado: ${v.id}`);
    }
    validatorIds.add(v.id);
  }

  if (definition.knowledge) {
    if (typeof definition.knowledge.toQuery !== 'function') {
      issues.push('knowledge do pack precisa de uma função toQuery');
    }
  }

  if (issues.length > 0) {
    throw new PackDefinitionError('Definição do pack inválida', issues);
  }

  const pack: DomainPack<TIn, TOut> = Object.freeze({ ...definition });

  return pack;
}
