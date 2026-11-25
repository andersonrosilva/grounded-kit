// [Passo 3 · VectorStore in-memory] Testes de `src/retrieval/memory-store.ts` (ADR-010; regras 15, 16).
import { describe, it } from 'vitest';
import { createMemoryStore } from '../../src/retrieval/memory-store';
import { runVectorStoreContract } from '../contract/vector-store.contract';

runVectorStoreContract('memory', (info) => createMemoryStore(info));

describe('cosineSimilarity', () => {
  it.todo('vetores idênticos têm similaridade 1');
  it.todo('vetores ortogonais têm similaridade 0');
  it.todo('vetores opostos têm similaridade -1');
  it.todo('dimensões diferentes ou norma zero seguem a decisão documentada (erro ou 0)');
});
