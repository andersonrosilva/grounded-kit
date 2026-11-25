// [Passo 2 · Pipeline] Testes de `src/core/pipeline.ts` usando fakes (ADR-006, ADR-010; regras 4–12; CR-03).
import { describe, it } from 'vitest';

describe('createPipeline · caminho feliz', () => {
  it.todo('devolve ok com data validada e usage quando a primeira resposta é válida');
  it.todo('chama o provider com o schema do pack');
});

describe('createPipeline · guardrail pre', () => {
  it.todo('block no estágio pre devolve blocked SEM chamar o provider (regra 7)');
});

describe('createPipeline · retry (regra 6)', () => {
  it.todo('JSON inválido gera nova tentativa com os erros como feedback no prompt');
  it.todo('falha de validator gera nova tentativa');
  it.todo('esgotado maxAttempts devolve invalid com errors e attempts');
  it.todo('maxAttempts padrão é 3');
  it.todo('nunca devolve dado não validado (CR-03)');
});

describe('createPipeline · guardrail post (regras 7 e 8)', () => {
  it.todo('block no estágio post devolve blocked sem conteúdo parcial');
  it.todo('modify é revalidado por schema e validators');
  it.todo('modify que quebra o schema devolve invalid');
});

describe('createPipeline · retrieval (regras 9 e 10)', () => {
  it.todo('sem knowledge/embeddings/store segue com exemplos vazios');
  it.todo('exemplos recuperados entram no prompt como dado');
});

describe('createPipeline · erros e tracer (regras 11 e 12)', () => {
  it.todo('ProviderError propaga como exceção e NÃO consome tentativa');
  it.todo('emite eventos de cada etapa no tracer');
  it.todo('eventos do tracer não contêm prompts nem respostas');
});
