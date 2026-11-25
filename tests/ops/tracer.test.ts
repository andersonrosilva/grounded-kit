// [Passo 4 · Tracer] Testes de `src/ops/tracer.ts` (ADR-007; regra 12; CR-04).
import { describe, it } from 'vitest';

describe('createNoopTracer', () => {
  it.todo('event não lança e não escreve nada');
});

describe('createConsoleTracer', () => {
  it.todo('escreve uma linha JSON por evento via log injetado');
  it.todo('inclui o nome do evento e os dados numéricos (tokens, latência)');
  it.todo('descarta chaves que carregam conteúdo (prompt, text, output)');
});
