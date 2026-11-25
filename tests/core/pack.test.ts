// [Passo 1 · definePack] Testes de `src/core/pack.ts` (ADR-005; regras 1, 2, 5). Escreva o teste antes da implementação.
import { describe, it } from 'vitest';

describe('definePack', () => {
  it.todo('devolve o pack com os mesmos campos e congelado (imutável)');
  it.todo('lança PackDefinitionError quando id ou version estão vazios');
  it.todo('lança PackDefinitionError quando outputSchema está ausente');
  it.todo('lança PackDefinitionError quando há ids de guardrail/validator duplicados');
  it.todo('lança PackDefinitionError quando knowledge não tem toQuery');
  it.todo('lista TODOS os problemas encontrados, não só o primeiro');
  it.todo('guardrails, validators e knowledge são opcionais');
});
