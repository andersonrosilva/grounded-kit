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
import type { IndexInfo, VectorStore } from '../types';

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
  throw new Error('not implemented');
}
