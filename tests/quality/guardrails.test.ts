// [Passo 2 · Guardrails] Testes de `src/quality/guardrails.ts` (ADR-002; regras 3, 7, 8).
import { describe, it } from 'vitest';

describe('runGuardrails', () => {
  it.todo('sem guardrails devolve allow');
  it.todo('executa só os guardrails do estágio pedido');
  it.todo('o primeiro block interrompe e informa reason e guardrailId');
  it.todo('modify devolve o output novo e o guardrailId');
  it.todo('guardrails rodam em ordem de declaração');
});
