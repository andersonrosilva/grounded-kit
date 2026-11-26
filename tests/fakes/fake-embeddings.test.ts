// [Passo 3 · Fake de Embeddings] Testes de `tests/fakes/fake-embeddings.ts` (ADR-010; regra 16).
// O fake precisa passar o contrato do port E sustentar o que o RAG assume (textos parecidos ficam próximos).
import { describe, expect, it } from 'vitest';
import { runEmbeddingsContract } from '../contract/embeddings.contract';
import { createFakeEmbeddings } from './fake-embeddings';

runEmbeddingsContract('fake', () => createFakeEmbeddings());

function cosine(a: readonly number[], b: readonly number[]): number {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const norm = (v: readonly number[]) =>
    Math.sqrt(v.reduce((sum, value) => sum + value * value, 0));
  return dot / (norm(a) * norm(b));
}

describe('createFakeEmbeddings', () => {
  it('usa 8 dimensões por padrão e respeita o valor informado', async () => {
    expect(createFakeEmbeddings().dimensions).toBe(8);
    const custom = createFakeEmbeddings(32);
    expect(custom.dimensions).toBe(32);
    const [vector] = await custom.embed(['qualquer texto']);
    expect(vector).toHaveLength(32);
  });

  it('o id muda quando as dimensões mudam (regra 16)', () => {
    expect(createFakeEmbeddings(8).id).not.toBe(createFakeEmbeddings(16).id);
    expect(createFakeEmbeddings(8).id).toBe(createFakeEmbeddings(8).id);
  });

  it('textos com palavras em comum ficam mais próximos do que textos sem relação', async () => {
    const embeddings = createFakeEmbeddings(64);
    const [base, parecido, diferente] = await embeddings.embed([
      'arroz com feijão',
      'feijão com arroz cozido',
      'salada de atum',
    ]);
    expect(cosine(base!, parecido!)).toBeGreaterThan(cosine(base!, diferente!));
  });

  it('ignora maiúsculas, acentos e espaços nas pontas ("Brócolis" e "brocolis" geram o mesmo vetor)', async () => {
    const embeddings = createFakeEmbeddings(32);
    const [a] = await embeddings.embed(['  Brócolis Cozido ']);
    const [b] = await embeddings.embed(['brocolis cozido']);
    expect(a).toEqual(b);
  });

  it('texto vazio ou só pontuação não quebra e devolve o vetor zerado', async () => {
    const embeddings = createFakeEmbeddings(8);
    const [empty, punctuation] = await embeddings.embed(['', '  ,.;!? ']);
    expect(empty).toEqual(new Array(8).fill(0));
    expect(punctuation).toEqual(new Array(8).fill(0));
  });

  it('devolve arrays novos a cada chamada (sem estado compartilhado)', async () => {
    const embeddings = createFakeEmbeddings(8);
    const [first] = await embeddings.embed(['arroz']);
    first![0] = 999;
    const [second] = await embeddings.embed(['arroz']);
    expect(second![0]).not.toBe(999);
  });

  it('rejeita dimensions que não seja inteiro positivo', () => {
    expect(() => createFakeEmbeddings(0)).toThrow();
    expect(() => createFakeEmbeddings(-4)).toThrow();
    expect(() => createFakeEmbeddings(2.5)).toThrow();
  });
});
