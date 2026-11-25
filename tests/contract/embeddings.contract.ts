/**
 * [Passo 3 · Contrato do port Embeddings] Suíte reutilizável para qualquer adaptador de embeddings.
 * Cumpre: ADR-010, ADR-008, critério de aceite 8. Regras da session: 16.
 */
import { describe, it } from 'vitest';
import type { Embeddings } from '../../src/retrieval/types';

export function runEmbeddingsContract(name: string, makeEmbeddings: () => Embeddings): void {
  describe(`contrato Embeddings · ${name}`, () => {
    it.todo('expõe id e dimensions > 0');
    it.todo('embed devolve um vetor por texto, na mesma ordem');
    it.todo('todos os vetores têm exatamente `dimensions` posições');
    it.todo('lista vazia devolve lista vazia');
    it.todo('é determinístico para o mesmo texto');
  });
}
