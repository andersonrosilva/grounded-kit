/**
 * [Passo 3 · VectorStore in-memory] Implementação de referência e de testes do port `VectorStore`.
 * Cumpre: ADR-010 (testes sem banco), ADR-008. Regras da session: 15, 16.
 *
 * Treino:
 *  - `cosineSimilarity(a, b)`: produto escalar / (norma a × norma b); vetores de tamanhos diferentes ou norma
 *    zero devem falhar de forma explícita (ou devolver 0 — decida e documente no teste).
 *  - `createMemoryStore`: guarde os itens em um `Map` por `id` (upsert substitui), exponha `info` e, em `query`,
 *    ordene por `score` decrescente e corte em `topK`. Valide a dimensão do vetor contra `info.dimensions`.
 */
import type { IndexInfo, VectorStore } from './types';

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  throw new Error('not implemented');
}

export function createMemoryStore(info: IndexInfo): VectorStore {
  throw new Error('not implemented');
}
