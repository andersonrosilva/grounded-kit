/**
 * [Passo 3 · Contrato do port VectorStore] Mesma suíte para o in-memory e para o pgvector (critério de aceite 9).
 * Cumpre: ADR-010 (+ emenda 2026-11-25), regras da session: 15, 16, 17.
 *
 * `makeStore` recebe o `IndexInfo` desejado e devolve um store LIMPO (para o pgvector: tabela isolada por teste).
 */
import { describe, it } from 'vitest';
import type { IndexInfo, VectorStore } from '../../src/retrieval/types';

export function runVectorStoreContract(
  name: string,
  makeStore: (info: IndexInfo) => Promise<VectorStore> | VectorStore,
): void {
  describe(`contrato VectorStore · ${name}`, () => {
    it.todo('expõe info com embeddingsId e dimensions informados');
    it.todo('upsert insere itens e query os encontra');
    it.todo('upsert com mesmo id substitui o item (não duplica)');
    it.todo('query ordena por similaridade (maior score primeiro) e respeita topK');
    it.todo('índice vazio devolve lista vazia (regra 10)');
    it.todo('rejeita vetor com dimensão diferente de info.dimensions');
    it.todo('payload volta íntegro (KnowledgeItem com metadata)');
  });
}
