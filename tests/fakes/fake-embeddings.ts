/**
 * [Passo 3 · Fake de Embeddings] Embeddings determinísticos e sem rede para testar retrieval (ADR-010).
 *
 * Treino: gere um vetor de `dimensions` posições a partir do texto de forma determinística (mesmo texto =>
 * mesmo vetor; textos parecidos => vetores próximos, ex.: contagem de letras/palavras por posição).
 * O `id` deve identificar o modelo falso (regra 16).
 */
import type { Embeddings } from '../../src/retrieval/types';

export function createFakeEmbeddings(dimensions = 8): Embeddings {
  throw new Error('not implemented');
}
