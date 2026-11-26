// [Passo 3 · Ingestão e consulta do RAG] Testes de `src/retrieval/knowledge.ts` (regras 9, 10, 16, 17).
// Isolados do resto: embeddings e store são dublês locais, então só `knowledge.ts` está em teste.
// Exceção, marcada no nome: os testes "com memory store" usam o `createMemoryStore` real.
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { DomainPack } from '../../src/core/pack';
import {
  assertCompatibleIndex,
  createMemoryStore,
  indexKnowledge,
  retrieveExamples,
  type Embeddings,
  type IndexInfo,
  type KnowledgeItem,
  type VectorHit,
  type VectorItem,
  type VectorStore,
} from '../../src/retrieval';

type In = { q: string };
type Out = { answer: string };

const INFO: IndexInfo = { embeddingsId: 'modelo-teste', dimensions: 3 };

/** Embeddings que consulta uma tabela texto -> vetor (texto desconhecido vira vetor zerado). */
function makeEmbeddings(table: Record<string, number[]> = {}, info: IndexInfo = INFO) {
  const embed = vi.fn(async (texts: string[]) =>
    texts.map((text) => table[text] ?? new Array<number>(info.dimensions).fill(0)),
  );
  const embeddings: Embeddings = { id: info.embeddingsId, dimensions: info.dimensions, embed };
  return Object.assign(embeddings, { embed });
}

/** Store espião: guarda o que recebe em `upsert` e devolve `hits` em `query`. */
function makeStore(info: IndexInfo = INFO, hits: VectorHit[] = []) {
  const upsert = vi.fn(async (_items: VectorItem[]) => {});
  const query = vi.fn(async (_vector: number[], _opts: { topK: number }) => hits);
  const store: VectorStore = { info, upsert, query };
  return { store, upsert, query };
}

function makePack(items?: KnowledgeItem[]): DomainPack<In, Out> {
  return {
    id: 'pack-teste',
    version: '1.0.0',
    prompts: { user: (input) => input.q },
    outputSchema: z.object({ answer: z.string() }),
    ...(items ? { knowledge: { items, toQuery: (input: In) => `consulta: ${input.q}` } } : {}),
  };
}

const ARROZ: KnowledgeItem = {
  id: 'r-arroz',
  text: 'arroz com feijão',
  metadata: { title: 'Arroz' },
};
const OMELETE: KnowledgeItem = { id: 'r-omelete', text: 'omelete de queijo' };
const SALADA: KnowledgeItem = { id: 'r-salada', text: 'salada de atum' };

const VECTORS: Record<string, number[]> = {
  [ARROZ.text]: [1, 0, 0],
  [OMELETE.text]: [0, 1, 0],
  [SALADA.text]: [0.9, 0.1, 0],
};

function upsertedItems(upsert: ReturnType<typeof makeStore>['upsert']): VectorItem[] {
  return upsert.mock.calls.flatMap(([items]) => items);
}

describe('assertCompatibleIndex', () => {
  it('passa quando embeddingsId e dimensions batem', () => {
    const { store } = makeStore({ embeddingsId: 'modelo-a', dimensions: 8 });
    const embeddings = makeEmbeddings({}, { embeddingsId: 'modelo-a', dimensions: 8 });
    expect(() => assertCompatibleIndex(store, embeddings)).not.toThrow();
  });

  it('erro explícito pedindo reindexação quando o modelo é outro', () => {
    const { store } = makeStore({ embeddingsId: 'modelo-a', dimensions: 8 });
    const embeddings = makeEmbeddings({}, { embeddingsId: 'modelo-b', dimensions: 8 });
    expect(() => assertCompatibleIndex(store, embeddings)).toThrow(/reindex/i);
  });

  it('erro explícito quando a dimensão é diferente', () => {
    const { store } = makeStore({ embeddingsId: 'modelo-a', dimensions: 8 });
    const embeddings = makeEmbeddings({}, { embeddingsId: 'modelo-a', dimensions: 16 });
    expect(() => assertCompatibleIndex(store, embeddings)).toThrow(/reindex/i);
  });
});

describe('indexKnowledge', () => {
  it('indexa todos os itens do pack e devolve a quantidade', async () => {
    const embeddings = makeEmbeddings(VECTORS);
    const { store, upsert } = makeStore();

    const result = await indexKnowledge(makePack([ARROZ, OMELETE, SALADA]), { embeddings, store });

    expect(result).toEqual({ indexed: 3 });
    expect(upsertedItems(upsert)).toEqual([
      { id: ARROZ.id, vector: [1, 0, 0], payload: ARROZ },
      { id: OMELETE.id, vector: [0, 1, 0], payload: OMELETE },
      { id: SALADA.id, vector: [0.9, 0.1, 0], payload: SALADA },
    ]);
  });

  it('com muitos itens, todos são embedados e enviados exatamente uma vez (qualquer tamanho de lote)', async () => {
    const items: KnowledgeItem[] = Array.from({ length: 250 }, (_, index) => ({
      id: `item-${index}`,
      text: `texto número ${index}`,
    }));
    const embeddings = makeEmbeddings();
    const { store, upsert } = makeStore();

    const result = await indexKnowledge(makePack(items), { embeddings, store });

    expect(result).toEqual({ indexed: 250 });
    const embeddedTexts = embeddings.embed.mock.calls.flatMap(([texts]) => texts);
    expect(embeddedTexts).toEqual(items.map((item) => item.text));
    expect(upsertedItems(upsert).map((item) => item.id)).toEqual(items.map((item) => item.id));
  });

  it('pack sem knowledge devolve indexed 0 e não chama embeddings nem store', async () => {
    const embeddings = makeEmbeddings();
    const { store, upsert } = makeStore();

    const result = await indexKnowledge(makePack(), { embeddings, store });

    expect(result).toEqual({ indexed: 0 });
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('knowledge com lista vazia devolve indexed 0', async () => {
    const { store } = makeStore();
    const result = await indexKnowledge(makePack([]), { embeddings: makeEmbeddings(), store });
    expect(result).toEqual({ indexed: 0 });
  });

  it('com memory store: reindexar o mesmo pack não duplica itens (upsert por id)', async () => {
    const embeddings = makeEmbeddings(VECTORS);
    const store = createMemoryStore(INFO);
    const pack = makePack([ARROZ, OMELETE, SALADA]);

    await indexKnowledge(pack, { embeddings, store });
    await indexKnowledge(pack, { embeddings, store });

    const hits = await store.query([1, 0, 0], { topK: 100 });
    expect(hits).toHaveLength(3);
  });

  it('recusa índice de outro modelo/dimensão com erro de reindexação, sem embedar nada (regra 17)', async () => {
    const embeddings = makeEmbeddings(VECTORS);
    const { store, upsert } = makeStore({ embeddingsId: 'outro-modelo', dimensions: 3 });

    await expect(indexKnowledge(makePack([ARROZ]), { embeddings, store })).rejects.toThrow(
      /reindex/i,
    );
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('retrieveExamples', () => {
  it('com memory store: devolve os KnowledgeItem mais similares à consulta, em ordem de similaridade', async () => {
    const store = createMemoryStore(INFO);
    await store.upsert([
      { id: ARROZ.id, vector: [1, 0, 0], payload: ARROZ },
      { id: OMELETE.id, vector: [0, 1, 0], payload: OMELETE },
      { id: SALADA.id, vector: [0.9, 0.1, 0], payload: SALADA },
    ]);
    const embeddings = makeEmbeddings({ 'consulta: arroz': [1, 0, 0] });

    const examples = await retrieveExamples(
      makePack([ARROZ, OMELETE, SALADA]),
      { q: 'arroz' },
      { embeddings, store },
    );

    expect(examples).toEqual([ARROZ, SALADA, OMELETE]);
  });

  it('embeda o texto de pack.knowledge.toQuery(input), não o input cru', async () => {
    const embeddings = makeEmbeddings();
    const { store } = makeStore();

    await retrieveExamples(makePack([ARROZ]), { q: 'feijão' }, { embeddings, store });

    expect(embeddings.embed).toHaveBeenCalledWith(['consulta: feijão']);
  });

  it('devolve só os payloads, na ordem em que o store devolveu os hits', async () => {
    const hits: VectorHit[] = [
      { id: OMELETE.id, score: 0.9, payload: OMELETE },
      { id: ARROZ.id, score: 0.5, payload: ARROZ },
    ];
    const { store } = makeStore(INFO, hits);

    const examples = await retrieveExamples(
      makePack([ARROZ, OMELETE]),
      { q: 'x' },
      { embeddings: makeEmbeddings(), store },
    );

    expect(examples).toEqual([OMELETE, ARROZ]);
  });

  it('respeita topK (padrão 3)', async () => {
    const embeddings = makeEmbeddings({ 'consulta: x': [1, 0, 0] });
    const { store, query } = makeStore();
    const pack = makePack([ARROZ]);

    await retrieveExamples(pack, { q: 'x' }, { embeddings, store });
    expect(query).toHaveBeenLastCalledWith([1, 0, 0], { topK: 3 });

    await retrieveExamples(pack, { q: 'x' }, { embeddings, store, topK: 5 });
    expect(query).toHaveBeenLastCalledWith([1, 0, 0], { topK: 5 });
  });

  it('pack sem knowledge devolve lista vazia sem consultar embeddings nem store (não é erro)', async () => {
    const embeddings = makeEmbeddings();
    const { store, query } = makeStore();

    expect(await retrieveExamples(makePack(), { q: 'x' }, { embeddings, store })).toEqual([]);
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('índice vazio devolve lista vazia (não é erro)', async () => {
    const { store } = makeStore(INFO, []);
    const examples = await retrieveExamples(
      makePack([ARROZ]),
      { q: 'x' },
      { embeddings: makeEmbeddings(), store },
    );
    expect(examples).toEqual([]);
  });

  it('recusa índice de outro modelo/dimensão com erro de reindexação (regra 17)', async () => {
    const { store, query } = makeStore({ embeddingsId: 'outro-modelo', dimensions: 3 });

    await expect(
      retrieveExamples(makePack([ARROZ]), { q: 'x' }, { embeddings: makeEmbeddings(), store }),
    ).rejects.toThrow(/reindex/i);
    expect(query).not.toHaveBeenCalled();
  });
});
