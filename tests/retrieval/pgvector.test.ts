// [Passo 3 · pgvector, unitário] Testes de `src/retrieval/pgvector` com um `client` falso — roda na suíte padrão, sem banco.
// Cumpre: emenda ao ADR-010; regras 16, 17, 18.
import { describe, it } from 'vitest';

describe('createPgVectorStore (client falso)', () => {
  it.todo('ensureSchema cria extensão e tabela e registra embeddingsId e dimensions');
  it.todo('ensureSchema falha com erro explícito se o índice existente usa outro modelo/dimensão (regra 17)');
  it.todo('upsert envia os valores por parâmetros, nunca concatenados no SQL');
  it.todo('query converte distância em score (maior = mais similar)');
  it.todo('rejeita nome de tabela inseguro');
  it.todo('nunca inclui a connection string em erros (regra 18)');
});
