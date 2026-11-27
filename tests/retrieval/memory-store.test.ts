// [Passo 3 · VectorStore in-memory] Testes de `src/retrieval/memory-store.ts` (ADR-010; regras 15, 16).
//
// Decisões documentadas aqui (o stub pedia "decida e documente"):
//  - `cosineSimilarity` com vetores de tamanhos diferentes LANÇA erro; com norma zero devolve 0.
//  - `upsert` e `query` com vetor de dimensão diferente de `info.dimensions` são rejeitados (promessa rejeitada).
import { describe, expect, it } from 'vitest';
import { cosineSimilarity, createMemoryStore } from '../../src/retrieval/memory-store';
import type { IndexInfo, KnowledgeItem, VectorItem } from '../../src/retrieval/types';

// DESABILITADO: memory-store pulado na trilha (tudo vai no Postgres/pgvector). Reative junto com os `describe.skip` abaixo.
// runVectorStoreContract('memory', (info) => createMemoryStore(info));

const INFO: IndexInfo = { embeddingsId: 'modelo-teste', dimensions: 3 };

function item(id: string, vector: number[], extra: Partial<KnowledgeItem> = {}): VectorItem {
  return { id, vector, payload: { id, text: `texto de ${id}`, ...extra } };
}

describe.skip('cosineSimilarity', () => {
  it('vetores idênticos têm similaridade 1', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it('vetores ortogonais têm similaridade 0', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 10);
  });

  it('vetores opostos têm similaridade -1', () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1, 10);
  });

  it('não depende da magnitude (só da direção)', () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });

  it('é simétrica', () => {
    expect(cosineSimilarity([1, 0, 2], [3, 1, 0])).toBeCloseTo(
      cosineSimilarity([3, 1, 0], [1, 0, 2]),
      10,
    );
  });

  it('dimensões diferentes lançam erro', () => {
    expect(() => cosineSimilarity([1, 2, 3], [1, 2])).toThrow();
  });

  it('norma zero devolve 0 (sem NaN)', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });
});

describe.skip('createMemoryStore', () => {
  it('expõe info com embeddingsId e dimensions informados', () => {
    expect(createMemoryStore(INFO).info).toEqual(INFO);
  });

  it('upsert insere itens e query os encontra com score de cosseno', async () => {
    const store = createMemoryStore(INFO);
    await store.upsert([item('a', [1, 0, 0])]);

    const hits = await store.query([1, 0, 0], { topK: 5 });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.id).toBe('a');
    expect(hits[0]?.score).toBeCloseTo(1, 10);
  });

  it('upsert com mesmo id substitui o item (não duplica)', async () => {
    const store = createMemoryStore(INFO);
    await store.upsert([item('a', [1, 0, 0], { text: 'versão antiga' })]);
    await store.upsert([item('a', [0, 1, 0], { text: 'versão nova' })]);

    const hits = await store.query([0, 1, 0], { topK: 10 });

    expect(hits).toHaveLength(1);
    expect(hits[0]?.payload.text).toBe('versão nova');
  });

  it('query ordena por similaridade (maior score primeiro) e respeita topK', async () => {
    const store = createMemoryStore(INFO);
    await store.upsert([item('b', [0, 1, 0]), item('a', [1, 0, 0]), item('c', [0.9, 0.1, 0])]);

    const all = await store.query([1, 0, 0], { topK: 10 });
    expect(all.map((hit) => hit.id)).toEqual(['a', 'c', 'b']);
    expect(all[0]!.score).toBeGreaterThan(all[1]!.score);
    expect(all[1]!.score).toBeGreaterThan(all[2]!.score);

    const top2 = await store.query([1, 0, 0], { topK: 2 });
    expect(top2.map((hit) => hit.id)).toEqual(['a', 'c']);
  });

  it('índice vazio devolve lista vazia (regra 10)', async () => {
    const store = createMemoryStore(INFO);
    expect(await store.query([1, 0, 0], { topK: 3 })).toEqual([]);
  });

  it('rejeita upsert de vetor com dimensão diferente de info.dimensions', async () => {
    const store = createMemoryStore(INFO);
    await expect(store.upsert([item('a', [1, 0])])).rejects.toThrow();
    expect(await store.query([1, 0, 0], { topK: 3 })).toEqual([]);
  });

  it('rejeita query com vetor de dimensão diferente de info.dimensions', async () => {
    const store = createMemoryStore(INFO);
    await expect(store.query([1, 0], { topK: 3 })).rejects.toThrow();
  });

  it('payload volta íntegro (KnowledgeItem com metadata)', async () => {
    const store = createMemoryStore(INFO);
    const payload: KnowledgeItem = {
      id: 'r1',
      text: 'Arroz com feijão. Calorias: 335 kcal.',
      metadata: { title: 'Arroz com feijão', calories: 335, tags: ['simples'] },
    };
    await store.upsert([{ id: 'r1', vector: [1, 0, 0], payload }]);

    const [hit] = await store.query([1, 0, 0], { topK: 1 });

    expect(hit?.payload).toEqual(payload);
  });
});
