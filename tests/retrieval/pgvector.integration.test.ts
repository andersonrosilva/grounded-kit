/**
 * [Passo 3 · pgvector, integração opt-in] Roda a MESMA suíte de contrato do VectorStore contra um Postgres real.
 * Só executa com `PGVECTOR_URL` definida; sem ela o bloco é ignorado e a suíte padrão segue sem rede (critério de aceite 9).
 * Cumpre: emenda ao ADR-010.
 *
 * Treino: dentro do bloco, crie um `pg` Client/Pool a partir de `process.env.PGVECTOR_URL` (instale `pg` antes),
 * use uma tabela isolada por teste e passe `makeStore` para `runVectorStoreContract`. Feche a conexão em `afterAll`.
 */
import { describe } from 'vitest';
import { runVectorStoreContract } from '../contract/vector-store.contract';

describe.skipIf(!process.env.PGVECTOR_URL)('pgvector · integração (opt-in)', () => {
  runVectorStoreContract('pgvector', () => {
    throw new Error('not implemented');
  });
});
