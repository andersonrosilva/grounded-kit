// [Passo 1 · definePack] Testes de `src/core/pack.ts` (ADR-005; regras 1, 2, 5).
//
// Decisão documentada: `id` e `version` só com espaços contam como vazios.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PackDefinitionError } from '../../src/core/errors';
import { definePack, type PackDefinition } from '../../src/core/pack';
import type { Guardrail, Validator } from '../../src/core/types';

type In = { q: string };
type Out = { answer: string };

const schema = z.object({ answer: z.string() });

function guardrail(id: string): Guardrail<In, Out> {
  return { id, stage: 'pre', check: async () => ({ action: 'allow' }) };
}

function validator(id: string): Validator<Out> {
  return { id, validate: () => ({ ok: true }) };
}

function definition(overrides: Partial<PackDefinition<In, Out>> = {}): PackDefinition<In, Out> {
  return {
    id: 'pack-teste',
    version: '1.0.0',
    prompts: { system: 'sistema', user: (input) => `pedido: ${input.q}` },
    outputSchema: schema,
    ...overrides,
  };
}

/** Executa `fn`, exige que lance `PackDefinitionError` e devolve o erro para inspeção. */
function packError(fn: () => unknown): PackDefinitionError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PackDefinitionError);
    return error as PackDefinitionError;
  }
  throw new Error('esperava que definePack lançasse PackDefinitionError');
}

const mentions = (error: PackDefinitionError, pattern: RegExp) =>
  error.issues.some((issue) => pattern.test(issue));

describe('definePack', () => {
  it('devolve o pack com os mesmos campos e congelado (imutável)', () => {
    const input = definition({
      guardrails: [guardrail('g1')],
      validators: [validator('v1')],
      knowledge: { items: [{ id: 'k1', text: 'texto' }], toQuery: (i) => i.q },
    });

    const pack = definePack(input);

    expect(pack.id).toBe('pack-teste');
    expect(pack.version).toBe('1.0.0');
    expect(pack.outputSchema).toBe(schema);
    expect(pack.prompts.system).toBe('sistema');
    expect(pack.prompts.user({ q: 'x' }, [])).toBe('pedido: x');
    expect(pack.guardrails).toHaveLength(1);
    expect(pack.validators).toHaveLength(1);
    expect(pack.knowledge?.items).toHaveLength(1);
    expect(Object.isFrozen(pack)).toBe(true);
    expect(() => {
      (pack as { id: string }).id = 'outro';
    }).toThrow(TypeError);
  });

  it('lança PackDefinitionError quando id ou version estão vazios', () => {
    expect(
      mentions(
        packError(() => definePack(definition({ id: '' }))),
        /\bid\b/i,
      ),
    ).toBe(true);
    expect(
      mentions(
        packError(() => definePack(definition({ version: '' }))),
        /version/i,
      ),
    ).toBe(true);
    expect(packError(() => definePack(definition({ id: '   ' }))).issues.length).toBeGreaterThan(0);
  });

  it('lança PackDefinitionError quando outputSchema está ausente', () => {
    const broken = { ...definition(), outputSchema: undefined } as unknown as PackDefinition<
      In,
      Out
    >;
    expect(
      mentions(
        packError(() => definePack(broken)),
        /outputSchema/,
      ),
    ).toBe(true);
  });

  it('lança PackDefinitionError quando prompts.user está ausente', () => {
    const broken = { ...definition(), prompts: { system: 'x' } } as unknown as PackDefinition<
      In,
      Out
    >;
    expect(
      mentions(
        packError(() => definePack(broken)),
        /prompts/,
      ),
    ).toBe(true);
  });

  it('lança PackDefinitionError quando há ids de guardrail duplicados', () => {
    const error = packError(() =>
      definePack(definition({ guardrails: [guardrail('dup'), guardrail('dup')] })),
    );
    expect(mentions(error, /guardrail/i)).toBe(true);
    expect(mentions(error, /dup/)).toBe(true);
  });

  it('lança PackDefinitionError quando há ids de validator duplicados', () => {
    const error = packError(() =>
      definePack(definition({ validators: [validator('dup'), validator('dup')] })),
    );
    expect(mentions(error, /validator/i)).toBe(true);
    expect(mentions(error, /dup/)).toBe(true);
  });

  it('lança PackDefinitionError quando knowledge não tem toQuery', () => {
    const broken = definition({
      knowledge: { items: [{ id: 'k', text: 't' }] } as unknown as PackDefinition<
        In,
        Out
      >['knowledge'],
    });
    expect(
      mentions(
        packError(() => definePack(broken)),
        /toQuery/,
      ),
    ).toBe(true);
  });

  it('lista TODOS os problemas encontrados, não só o primeiro', () => {
    const broken = {
      ...definition({ id: '', version: '', guardrails: [guardrail('x'), guardrail('x')] }),
      outputSchema: undefined,
    } as unknown as PackDefinition<In, Out>;

    const error = packError(() => definePack(broken));

    expect(error.issues.length).toBeGreaterThanOrEqual(4);
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('guardrails, validators e knowledge são opcionais', () => {
    const pack = definePack(definition());
    expect(pack.guardrails).toBeUndefined();
    expect(pack.validators).toBeUndefined();
    expect(pack.knowledge).toBeUndefined();
  });

  it('ids iguais em guardrail e validator (listas diferentes) são permitidos', () => {
    expect(() =>
      definePack(
        definition({ guardrails: [guardrail('mesmo')], validators: [validator('mesmo')] }),
      ),
    ).not.toThrow();
  });
});
