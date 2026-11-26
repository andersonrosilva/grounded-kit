// [Passo 3 · pgvector, unitário] Testes de `src/retrieval/pgvector` com um `client` falso — roda na suíte padrão, sem banco.
// Cumpre: emenda ao ADR-010; regras 16, 17, 18.
//
// Decisões documentadas aqui (o stub pedia "escolha e documente"):
//  - Tabela padrão: `knowledge_vectors`. Nome de tabela válido: letras minúsculas, dígitos e `_`, começando por letra
//    ou `_`; nome inválido faz `createPgVectorStore` LANÇAR na criação.
//  - Metadados do índice: o SELECT que lê o índice existente devolve linhas `{ embeddings_id, dimensions }`.
//  - O SELECT do `query` devolve linhas `{ id, payload, distance }` (distância de cosseno, `<=>`), já ordenadas; o
//    `score` devolvido é `1 - distance`. O vetor vai como parâmetro `JSON.stringify(vector)` (ex.: "[1,0,0]").
//  - Vetor de dimensão errada é rejeitado ANTES de falar com o banco.
import { describe, expect, it, vi } from 'vitest';
import { createPgVectorStore, type PgClientLike } from '../../src/retrieval/pgvector';
import type { KnowledgeItem, VectorItem } from '../../src/retrieval/types';

const INFO = { embeddingsId: 'modelo-teste', dimensions: 3 };

type Row = Record<string, unknown>;
type Responder = (text: string, params: unknown[] | undefined) => Row[];

function makeClient(respond: Responder = () => []) {
  const calls: { text: string; params: unknown[] | undefined }[] = [];
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return { rows: respond(text, params) };
  });
  const client: PgClientLike = { query };
  return { client, calls, query };
}

const isSelect = (text: string) => /^\s*select/i.test(text);
const itemOf = (id: string, vector: number[], extra: Partial<KnowledgeItem> = {}): VectorItem => ({
  id,
  vector,
  payload: { id, text: `texto de ${id}`, ...extra },
});

describe('createPgVectorStore (client falso)', () => {
  it('expõe info com embeddingsId e dimensions informados', () => {
    const { client } = makeClient();
    expect(createPgVectorStore({ ...INFO, client }).info).toEqual(INFO);
  });

  it('ensureSchema cria extensão e tabela e registra embeddingsId e dimensions', async () => {
    const { client, calls } = makeClient();

    await createPgVectorStore({ ...INFO, client }).ensureSchema();

    const texts = calls.map((call) => call.text);
    expect(texts.some((text) => /create extension if not exists vector/i.test(text))).toBe(true);
    expect(
      texts.some((text) => /create table if not exists/i.test(text) && /vector\(3\)/i.test(text)),
    ).toBe(true);
    // O modelo e a dimensão ficam registrados no banco (por parâmetro ou no próprio SQL).
    const registered = calls.some(
      (call) => call.params?.includes('modelo-teste') && call.params.includes(3),
    );
    expect(registered).toBe(true);
  });

  it('usa a tabela padrão knowledge_vectors e respeita a tabela informada', async () => {
    const padrao = makeClient();
    await createPgVectorStore({ ...INFO, client: padrao.client }).ensureSchema();
    expect(padrao.calls.some((call) => call.text.includes('knowledge_vectors'))).toBe(true);

    const custom = makeClient();
    await createPgVectorStore({
      ...INFO,
      client: custom.client,
      table: 'minha_tabela',
    }).ensureSchema();
    expect(custom.calls.some((call) => call.text.includes('minha_tabela'))).toBe(true);
    expect(custom.calls.some((call) => call.text.includes('knowledge_vectors'))).toBe(false);
  });

  it('ensureSchema passa quando o índice existente usa o mesmo modelo e dimensão', async () => {
    const { client } = makeClient((text) =>
      isSelect(text) ? [{ embeddings_id: 'modelo-teste', dimensions: 3 }] : [],
    );
    await expect(createPgVectorStore({ ...INFO, client }).ensureSchema()).resolves.toBeUndefined();
  });

  it('ensureSchema falha com erro explícito se o índice existente usa outro modelo (regra 17)', async () => {
    const { client } = makeClient((text) =>
      isSelect(text) ? [{ embeddings_id: 'outro-modelo', dimensions: 3 }] : [],
    );
    await expect(createPgVectorStore({ ...INFO, client }).ensureSchema()).rejects.toThrow(
      /reindex/i,
    );
  });

  it('ensureSchema falha com erro explícito se o índice existente usa outra dimensão (regra 17)', async () => {
    const { client } = makeClient((text) =>
      isSelect(text) ? [{ embeddings_id: 'modelo-teste', dimensions: 768 }] : [],
    );
    await expect(createPgVectorStore({ ...INFO, client }).ensureSchema()).rejects.toThrow(
      /reindex/i,
    );
  });

  it('upsert envia os valores por parâmetros, nunca concatenados no SQL', async () => {
    const { client, calls } = makeClient();
    const store = createPgVectorStore({ ...INFO, client });
    const hostile = itemOf("x'); DROP TABLE alvo; --", [0.1, 0.2, 0.3], {
      text: "texto com ' aspas",
    });

    await store.upsert([hostile]);

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.text).toMatch(/on conflict/i);
    expect(call!.text).not.toContain('DROP TABLE');
    expect(call!.text).not.toContain("texto com ' aspas");
    expect(call!.params).toContain(hostile.id);
    expect(call!.params).toContain(JSON.stringify(hostile.vector));
    expect(JSON.stringify(call!.params)).toContain("texto com ' aspas");
  });

  it('upsert de lista vazia não fala com o banco', async () => {
    const { client, query } = makeClient();
    await createPgVectorStore({ ...INFO, client }).upsert([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('upsert rejeita vetor de dimensão errada antes de falar com o banco', async () => {
    const { client, query } = makeClient();
    await expect(
      createPgVectorStore({ ...INFO, client }).upsert([itemOf('a', [1, 0])]),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it('query converte distância em score (maior = mais similar) e preserva a ordem', async () => {
    const { client, calls } = makeClient(() => [
      { id: 'a', payload: { id: 'a', text: 'A' }, distance: 0.1 },
      { id: 'b', payload: { id: 'b', text: 'B' }, distance: 0.4 },
    ]);

    const hits = await createPgVectorStore({ ...INFO, client }).query([1, 0, 0], { topK: 3 });

    expect(hits.map((hit) => hit.id)).toEqual(['a', 'b']);
    expect(hits[0]?.score).toBeCloseTo(0.9, 10);
    expect(hits[1]?.score).toBeCloseTo(0.6, 10);
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
    expect(hits[0]?.payload).toEqual({ id: 'a', text: 'A' });
    expect(calls[0]!.text).toContain('<=>');
    expect(calls[0]!.text).toMatch(/limit/i);
    expect(calls[0]!.params).toContain(JSON.stringify([1, 0, 0]));
    expect(calls[0]!.params).toContain(3);
  });

  it('query sem linhas devolve lista vazia', async () => {
    const { client } = makeClient(() => []);
    expect(await createPgVectorStore({ ...INFO, client }).query([1, 0, 0], { topK: 3 })).toEqual(
      [],
    );
  });

  it('query rejeita vetor de dimensão errada antes de falar com o banco', async () => {
    const { client, query } = makeClient();
    await expect(
      createPgVectorStore({ ...INFO, client }).query([1, 0], { topK: 3 }),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it('rejeita nome de tabela inseguro e aceita nomes válidos', () => {
    const { client } = makeClient();
    const unsafe = ['alvo; drop table x', 'a b', '1tabela', 'a-b', '', 'tabela"', 'public.itens'];
    for (const table of unsafe) {
      expect(
        () => createPgVectorStore({ ...INFO, client, table }),
        `tabela ${JSON.stringify(table)}`,
      ).toThrow();
    }
    for (const table of ['knowledge_vectors', '_privada', 'itens2']) {
      expect(() => createPgVectorStore({ ...INFO, client, table })).not.toThrow();
    }
  });

  it('nunca inclui a connection string em erros (regra 18)', async () => {
    const leaky = new Error('connection to postgres://usuario:SENHA-SECRETA@db:5432/app failed');
    const { client } = makeClient(() => {
      throw leaky;
    });
    const store = createPgVectorStore({ ...INFO, client });

    const failures = await Promise.all([
      store.ensureSchema().catch((e: unknown) => e),
      store.upsert([itemOf('a', [1, 0, 0])]).catch((e: unknown) => e),
      store.query([1, 0, 0], { topK: 1 }).catch((e: unknown) => e),
    ]);

    for (const failure of failures) {
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).not.toContain('SENHA-SECRETA');
    }
  });
});
