// [Passo 2 · Saída estruturada] Testes de `src/quality/structured-output.ts` (ADR-003; regras 5, 6; CR-03).
import { describe, it } from 'vitest';

describe('parseStructuredOutput', () => {
  it.todo('JSON válido que cumpre o schema devolve ok com data tipada');
  it.todo('texto que não é JSON devolve ok:false com mensagem clara');
  it.todo('JSON que viola o schema devolve ok:false com os campos problemáticos');
  it.todo('não extrai JSON de texto com lixo ao redor (sem regex — CR-03)');
});

describe('formatSchemaErrors', () => {
  it.todo('gera uma frase curta por problema, citando o caminho do campo');
});

describe('runValidators', () => {
  it.todo('sem validators devolve lista vazia');
  it.todo('devolve a mensagem de cada validator que falhou');
  it.todo('roda todos os validators, não para no primeiro erro');
});
