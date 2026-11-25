// [Passo 2 · Prompt] Testes de `src/core/prompt.ts` (regras 6, 9, 10).
import { describe, it } from 'vitest';

describe('renderExamples', () => {
  it.todo('lista vazia devolve string vazia (recuperação vazia não é erro)');
  it.todo('cada exemplo aparece em bloco delimitado e rotulado como dado, não instrução');
  it.todo('texto do exemplo com "ignore as instruções anteriores" continua sendo só dado dentro do bloco');
});

describe('renderRetryFeedback', () => {
  it.todo('inclui todas as mensagens de erro da tentativa anterior');
});

describe('buildPrompt', () => {
  it.todo('usa pack.prompts.user(input, examples) como base do prompt');
  it.todo('repassa o system do pack');
  it.todo('na primeira tentativa não inclui feedback de retry');
  it.todo('com previousErrors anexa o feedback de retry');
});
