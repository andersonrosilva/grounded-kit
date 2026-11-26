/**
 * [Passo 3 · Ingestão e consulta do RAG] Indexa a base do pack e recupera exemplos para o prompt.
 * Cumpre: ADR-001, ADR-008. Regras da session: 9, 10, 16, 17. CR-01.
 *
 * Duas fases separadas:
 *  1. INGESTÃO (`indexKnowledge`): itens do pack -> embeddings -> `store.upsert`. Roda uma vez (ou ao mudar a base).
 *  2. CONSULTA (`retrieveExamples`): `pack.knowledge.toQuery(input)` -> embed -> `store.query(topK)` -> exemplos.
 *
 * Treino:
 *  - `assertCompatibleIndex`: compare `store.info` com `embeddings.id`/`embeddings.dimensions`; divergência =>
 *    erro explícito pedindo reindexação (regra 17). Chame-a nas duas fases.
 *  - `indexKnowledge`: embede em lotes (decida o tamanho), monte `VectorItem[]` e faça `upsert`. Pack sem
 *    `knowledge` => `{ indexed: 0 }`.
 *  - `retrieveExamples`: pack sem `knowledge` ou índice vazio => `[]` (não é erro — regra 10). Devolva só os
 *    `payload` (KnowledgeItem) na ordem de similaridade.
 */
import type { DomainPack } from '../core/pack';
import type { Embeddings, KnowledgeItem, VectorStore } from './types';

export interface KnowledgeDeps {
  embeddings: Embeddings;
  store: VectorStore;
}

export function assertCompatibleIndex(store: VectorStore, embeddings: Embeddings): void {
  if (store.info.embeddingsId !== embeddings.id) {
    throw new Error(`Id incompatível: ${store.info.embeddingsId} vs ${embeddings.id} (reindexar)`);
  }
  if (store.info.dimensions !== embeddings.dimensions) {
    throw new Error(`Dimensão incompatível: ${store.info.dimensions} vs ${embeddings.dimensions} (reindexar)`);
  }  
}

export function indexKnowledge<TIn, TOut>(
  pack: DomainPack<TIn, TOut>,
  deps: KnowledgeDeps,
): Promise<{ indexed: number }> {
  throw new Error('not implemented');
}

export function retrieveExamples<TIn, TOut>(
  pack: DomainPack<TIn, TOut>,
  input: TIn,
  deps: KnowledgeDeps & { topK?: number },
): Promise<KnowledgeItem[]> {
  throw new Error('not implemented');
}
