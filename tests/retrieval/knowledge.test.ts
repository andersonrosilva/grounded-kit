// [Passo 3 · Ingestão e consulta do RAG] Testes de `src/retrieval/knowledge.ts` com fakes (regras 9, 10, 16, 17).
import { describe, it } from 'vitest';

describe('assertCompatibleIndex', () => {
  it.todo('passa quando embeddingsId e dimensions batem');
  it.todo('erro explícito pedindo reindexação quando o modelo é outro');
  it.todo('erro explícito quando a dimensão é diferente');
});

describe('indexKnowledge', () => {
  it.todo('indexa todos os itens do pack e devolve a quantidade');
  it.todo('pack sem knowledge devolve indexed 0');
  it.todo('reindexar o mesmo pack não duplica itens (upsert por id)');
});

describe('retrieveExamples', () => {
  it.todo('devolve os KnowledgeItem mais similares à consulta de toQuery(input), em ordem');
  it.todo('respeita topK (padrão 3)');
  it.todo('pack sem knowledge ou índice vazio devolve lista vazia (não é erro)');
});
