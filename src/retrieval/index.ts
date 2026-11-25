/** [Passo 3] Exports públicos de `ai-kit/retrieval`. O pgvector fica no subpath `ai-kit/retrieval/pgvector`. */
export type {
  Embeddings,
  IndexInfo,
  KnowledgeItem,
  VectorHit,
  VectorItem,
  VectorStore,
} from './types';
export { cosineSimilarity, createMemoryStore } from './memory-store';
export type { KnowledgeDeps } from './knowledge';
export { assertCompatibleIndex, indexKnowledge, retrieveExamples } from './knowledge';
