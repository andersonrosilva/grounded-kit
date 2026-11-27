/**
 * [Passo 3 · Adaptador pgvector] `VectorStore` sobre Postgres + extensão pgvector (subpath `ai-kit/retrieval/pgvector`).
 * Cumpre: emenda ao ADR-010 (2026-11-25), ADR-008, ADR-004 (`pg` é dependência peer OPCIONAL). Regras: 16, 17, 18. CR-04.
 *
 * O `client` é um tipo mínimo compatível com `pg` (`query(text, params)`): assim o adaptador é testável com um
 * cliente falso e não importa `pg` diretamente. A connection string vem do chamador (de `PGVECTOR_URL`) e NUNCA é
 * logada nem enviada ao tracer (regra 18).
 *
 * Treino — confirme na documentação oficial do pgvector antes de escrever o SQL:
 *  - `ensureSchema()`: criar a extensão e a tabela (id, vetor com a dimensão correta, payload JSON) e registrar
 *    `embeddingsId` + `dimensions` do índice; se o índice já existir com outro modelo/dimensão => erro pedindo
 *    reindexação (regra 17).
 *  - `upsert`: inserção com resolução de conflito por `id`, valores sempre por parâmetros (nunca concatenados).
 *  - `query`: ordenar por distância de cosseno e converter para `score` (maior = mais similar, como no memory-store).
 *  - nome de tabela vem de opção: valide-o (identificador seguro) antes de interpolar no SQL.
 */
import type { IndexInfo, KnowledgeItem, VectorStore } from '../types';

export interface PgClientLike {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface PgVectorStoreOptions extends IndexInfo {
  client: PgClientLike;
  /** Nome da tabela. Padrão a escolher e documentar no teste. */
  table?: string;
}

export interface PgVectorStore extends VectorStore {
  /** Cria extensão/tabela/metadados do índice e valida compatibilidade com o modelo de embeddings. */
  ensureSchema(): Promise<void>;
}

export function createPgVectorStore(options: PgVectorStoreOptions): PgVectorStore {
  const tableName = options.table ?? 'knowledge_vectors';
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    throw new Error(`Nome de tabela inválido: ${tableName}`);
  }
  if (!Number.isInteger(options.dimensions) || options.dimensions <= 0) {
    throw new Error(`Dimensão inválida: ${options.dimensions}`);
  }
  const metaTable = `${tableName}_meta`;

  // Ponto único de acesso ao banco: nunca propaga a mensagem original (pode conter a connection string — regra 18).
  async function run(text: string, params?: unknown[]): Promise<unknown[]> {
    try {
      return (await options.client.query(text, params)).rows;
    } catch {
      throw new Error('pgvector: falha ao executar consulta no banco');
    }
  }

  function assertDimensions(vector: number[]): void {
    if (vector.length !== options.dimensions) {
      throw new Error(
        `Vetor de dimensão incorreta: esperado ${options.dimensions}, recebido ${vector.length}`,
      );
    }
  }

  return {
    info: { embeddingsId: options.embeddingsId, dimensions: options.dimensions },

    async ensureSchema() {
      await run('CREATE EXTENSION IF NOT EXISTS vector');
      await run(
        `CREATE TABLE IF NOT EXISTS ${metaTable} (
           id INT PRIMARY KEY DEFAULT 1,
           embeddings_id TEXT NOT NULL,
           dimensions INT NOT NULL
         )`,
      );

      const rows = (await run(
        `SELECT embeddings_id, dimensions FROM ${metaTable} WHERE id = 1`,
      )) as { embeddings_id: string; dimensions: number }[];
      const existing = rows[0];

      if (existing) {
        if (existing.embeddings_id !== options.embeddingsId) {
          throw new Error(
            `Índice criado com outro modelo (${existing.embeddings_id} vs ${options.embeddingsId}): reindexar`,
          );
        }
        if (Number(existing.dimensions) !== options.dimensions) {
          throw new Error(
            `Índice criado com outra dimensão (${existing.dimensions} vs ${options.dimensions}): reindexar`,
          );
        }
      } else {
        await run(
          `INSERT INTO ${metaTable} (id, embeddings_id, dimensions) VALUES (1, $1, $2)
           ON CONFLICT (id) DO UPDATE SET embeddings_id = EXCLUDED.embeddings_id, dimensions = EXCLUDED.dimensions`,
          [options.embeddingsId, options.dimensions],
        );
      }

      await run(
        `CREATE TABLE IF NOT EXISTS ${tableName} (
           id TEXT PRIMARY KEY,
           vector VECTOR(${options.dimensions}),
           payload JSONB NOT NULL
         )`,
      );
    },

    async upsert(items) {
      // Valida tudo antes de gravar qualquer item.
      for (const item of items) assertDimensions(item.vector);
      for (const item of items) {
        await run(
          `INSERT INTO ${tableName} (id, vector, payload) VALUES ($1, $2::vector, $3::jsonb)
           ON CONFLICT (id) DO UPDATE SET vector = EXCLUDED.vector, payload = EXCLUDED.payload`,
          [item.id, JSON.stringify(item.vector), JSON.stringify(item.payload)],
        );
      }
    },

    async query(vector, opts) {
      assertDimensions(vector);
      const rows = (await run(
        `SELECT id, payload, vector <=> $1::vector AS distance
         FROM ${tableName}
         ORDER BY vector <=> $1::vector
         LIMIT $2`,
        [JSON.stringify(vector), opts.topK],
      )) as { id: string; payload: KnowledgeItem; distance: number | string }[];

      return rows.map((row) => ({
        id: row.id,
        payload: row.payload,
        score: 1 - Number(row.distance), // maior = mais similar
      }));
    },
  };
}
