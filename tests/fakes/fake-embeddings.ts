/**
 * [Passo 3 · Fake de Embeddings] Embeddings determinísticos e sem rede para testar retrieval (ADR-010).
 *
 * Técnica: "hashing de palavras" (bag-of-words em baldes). Cada palavra normalizada (minúsculas, sem acento) cai em um
 * balde `hash(palavra) % dimensions` e soma 1 nele. Textos com palavras em comum compartilham baldes, então ficam
 * próximos pelo cosseno; textos sem relação ficam distantes (com poucas dimensões há colisões: use 32+ para ranking).
 *
 * Decisão documentada: texto sem nenhuma palavra (vazio ou só pontuação) devolve o vetor zerado.
 */
import type { Embeddings } from '../../src/retrieval/types';

/** Minúsculas, sem acento, só letras/números separados por espaço. */
function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/** FNV-1a de 32 bits, sempre sem sinal (evita índice negativo no `%`). */
function hashWord(word: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < word.length; i += 1) {
    hash ^= word.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function embedOne(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (const word of tokenize(text)) {
    const bucket = hashWord(word) % dimensions;
    vector[bucket] = (vector[bucket] ?? 0) + 1;
  }
  return vector;
}

export function createFakeEmbeddings(dimensions = 8): Embeddings {
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error(`dimensions deve ser um inteiro positivo (recebido: ${dimensions})`);
  }
  return {
    id: `fake-hash-${dimensions}`,
    dimensions,
    embed(texts: string[]): Promise<number[][]> {
      return Promise.resolve(texts.map((text) => embedOne(text, dimensions)));
    },
  };
}
