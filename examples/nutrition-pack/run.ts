/**
 * [Passo 6 · Quickstart] Roda o pack de exemplo ponta a ponta: indexar -> consultar -> gerar -> validar -> moderar.
 * Escolha o provider por variável de ambiente (Ollama ou Gemini); nada de chave no código (CR-04).
 *
 * Treino de `main`:
 *  1. Leia as variáveis de `.env.example` (OLLAMA_*, GEMINI_*, PGVECTOR_URL); falte alguma => erro com a lista do que falta.
 *  2. Monte `embeddings` (Ollama) e `store` (`createMemoryStore`, ou `createPgVectorStore` se houver PGVECTOR_URL).
 *  3. FASE DE INGESTÃO: `indexKnowledge(pack, { embeddings, store })`.
 *  4. FASE DE CONSULTA: `createPipeline({ provider, embeddings, store })` e `pipeline.run(pack, input)`.
 *  5. Trate os três resultados: ok | blocked | invalid.
 * Não há chamada a `main()` no módulo: execute-o por um script quando implementar (ex.: com `tsx`, se decidir instalá-lo).
 */
export async function main(): Promise<void> {
  throw new Error('not implemented');
}
