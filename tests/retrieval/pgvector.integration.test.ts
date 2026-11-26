/**
 * [Passo 3 · pgvector, integração opt-in] Roda a MESMA suíte de contrato do VectorStore contra um Postgres real.
 * Só executa com `PGVECTOR_URL` definida; sem ela o bloco é ignorado e a suíte padrão segue sem rede (critério de aceite 9).
 * Cumpre: emenda ao ADR-010.
 *
 * Cada teste recebe uma tabela própria (nome aleatório), criada por `ensureSchema()`; o `afterAll` apaga as tabelas e
 * fecha o pool. A connection string vem só do ambiente e nunca é impressa (regra 18).
 */
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe } from 'vitest';
import { createPgVectorStore } from '../../src/retrieval/pgvector';
import { runVectorStoreContract } from '../contract/vector-store.contract';

describe.skipIf(!process.env.PGVECTOR_URL)('pgvector · integração (opt-in)', () => {
  let pool: Pool;
  const tables: string[] = [];

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.PGVECTOR_URL });
  });

  afterAll(async () => {
    for (const table of tables) {
      await pool.query(`DROP TABLE IF EXISTS ${table}`);
    }
    await pool.end();
  });

  runVectorStoreContract('pgvector', async (info) => {
    const table = `contract_${randomBytes(6).toString('hex')}`;
    tables.push(table);
    const store = createPgVectorStore({ ...info, client: pool, table });
    await store.ensureSchema();
    return store;
  });
});
