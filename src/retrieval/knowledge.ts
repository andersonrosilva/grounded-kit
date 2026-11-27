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
 *  - `retrieveExamples` (passo a passo, nesta ordem):
 *      1. Pack sem `pack.knowledge` => devolva `[]` JÁ, sem chamar `embeddings` nem `store` (regra 10: RAG é opcional,
 *         ausência não é erro). Teste: "pack sem knowledge ... sem consultar embeddings nem store".
 *      2. `assertCompatibleIndex(store, embeddings)` ANTES de qualquer custo (embed custa chamada ao modelo). Índice de
 *         outro modelo/dimensão => lance o erro de reindexação e NÃO chame `store.query` (regra 17).
 *      3. Texto da consulta = `pack.knowledge.toQuery(input)` — é ele que vai para o embed, nunca o `input` cru
 *         (o pack decide o que representa "o pedido" semanticamente). `embeddings.embed([texto])` recebe um array de
 *         UM texto e devolve `number[][]`; o vetor da consulta é a primeira (e única) linha.
 *      4. `topK = deps.topK ?? 3` (padrão 3; respeite o valor informado). Chame
 *         `store.query(vetor, { topK })`.
 *      5. Devolva `hits.map((hit) => hit.payload)`: só os `KnowledgeItem`, na MESMA ordem do store (ele já ordena do
 *         mais para o menos similar; não reordene, não filtre, não exponha `score`). Índice vazio => `hits` vazio =>
 *         `[]` (também não é erro).
 *    Erros do store/embeddings sobem como estão: quem decide degradar (seguir sem exemplos) é o pipeline, não aqui.
 *    Não persiste nada nem muda o índice: é só leitura. Assinatura é `Promise`, então a função deve ser `async`
 *    (hoje o stub lança de forma síncrona).
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

export async function indexKnowledge<TIn, TOut>(
  pack: DomainPack<TIn, TOut>,
  deps: KnowledgeDeps,
): Promise<{ indexed: number }> {

  if (!pack.knowledge || !pack.knowledge.items || pack.knowledge.items.length === 0) {
    return { indexed: 0 };
  }

  const store = deps.store;
  const embeddings = deps.embeddings;

  assertCompatibleIndex(store, embeddings);

  const knowledgeItems = pack.knowledge.items;
  const items = knowledgeItems.map((item) => item.text);

  const vectors = await embeddings.embed(items);

  if (!vectors || vectors.length !== items.length) {
    throw new Error(`embeddings.embed devolveu ${vectors?.length ?? 0} vetores, esperado ${items.length}`);
  }

  const vectorItems = knowledgeItems.map((item, index) => {
    const vector = vectors[index];
    if (!vector) {
      throw new Error(`embeddings.embed não devolveu vetor para o item ${item.id}`);
    }
    return { id: item.id, vector, payload: item };
  });

  await store.upsert(vectorItems);

  return { indexed: vectorItems.length };
}

export async function retrieveExamples<TIn, TOut>(pack: DomainPack<TIn, TOut>, input: TIn, deps: KnowledgeDeps & { topK?: number }): Promise<KnowledgeItem[]> {
  const store = deps.store;
  const embeddings = deps.embeddings;

  if (!pack.knowledge) {
    return [];
  }

  assertCompatibleIndex(store, embeddings);

  const query = pack.knowledge.toQuery(input);

  const [vector] = await embeddings.embed([query]);

  if (!vector) {
    throw new Error('embeddings.embed devolveu vetor indefinido');
  }

  const hits = await store.query(vector, { topK: deps.topK ?? 3 });

  return hits.map((hit) => hit.payload);
}
