/**
 * [Passo 3 · Estrutura de dados do RAG] Ports `Embeddings` e `VectorStore` + tipos da base de conhecimento.
 * Cumpre: ADR-001, ADR-008. Regras da session: 9, 10, 16, 17. CR-01.
 *
 * Fluxo de dados (os 3 tipos que você descreveu):
 *   KnowledgeItem  --(Embeddings.embed)-->  VectorItem  --(VectorStore.upsert)-->  índice
 *   consulta ----(Embeddings.embed)----> vetor ----(VectorStore.query)----> VectorHit[] ----> exemplos no prompt
 *
 * Só tipos: não há corpo para implementar.
 */

/** Unidade da base curada de um pack. `text` é o que será embedado E mostrado ao modelo como exemplo. */
export interface KnowledgeItem {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface Embeddings {
  /** Identifica modelo + versão; vai junto do índice (regra 16). */
  readonly id: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorItem {
  id: string;
  vector: number[];
  payload: KnowledgeItem;
}

export interface VectorHit {
  id: string;
  /** Maior = mais similar (cosseno). */
  score: number;
  payload: KnowledgeItem;
}

/** Com qual modelo de embeddings o índice foi construído; trocar o modelo exige reindexar (regras 16–17). */
export interface IndexInfo {
  embeddingsId: string;
  dimensions: number;
}

export interface VectorStore {
  readonly info: IndexInfo;
  upsert(items: VectorItem[]): Promise<void>;
  query(vector: number[], opts: { topK: number }): Promise<VectorHit[]>;
}
