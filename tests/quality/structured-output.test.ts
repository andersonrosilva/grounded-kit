// [Passo 2 · Saída estruturada] Testes de `src/quality/structured-output.ts` (ADR-003; regras 5, 6; CR-03).
//
// Decisões documentadas aqui:
//  - O caminho de um campo aninhado é citado com pontos: `ingredients.0.grams`.
//  - `formatSchemaErrors` com algo que NÃO é erro do Zod devolve uma lista com a mensagem (`Error`) ou `String(valor)`.
//  - `runValidators` devolve exatamente o texto de `error` de cada validator que falhou (sem prefixo).
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Validator } from '../../src/core/types';
import { formatSchemaErrors, parseStructuredOutput, runValidators } from '../../src/quality';

const schema = z.object({
  title: z.string(),
  calories: z.number(),
  ingredients: z.array(z.object({ name: z.string(), grams: z.number().positive() })),
});
type Recipe = z.infer<typeof schema>;

const VALID: Recipe = {
  title: 'Arroz com feijão',
  calories: 335,
  ingredients: [{ name: 'arroz branco cozido', grams: 150 }],
};

describe('parseStructuredOutput', () => {
  it('JSON válido que cumpre o schema devolve ok com data tipada', () => {
    const outcome = parseStructuredOutput(JSON.stringify(VALID), schema);
    expect(outcome).toEqual({ ok: true, data: VALID });
  });

  it('texto que não é JSON devolve ok:false com mensagem clara', () => {
    const outcome = parseStructuredOutput('isso não é json', schema);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors.length).toBeGreaterThan(0);
      expect(outcome.errors.join(' ')).toMatch(/json/i);
    }
    expect(outcome).not.toHaveProperty('data');
  });

  it('JSON que viola o schema devolve ok:false com os campos problemáticos', () => {
    const outcome = parseStructuredOutput(
      JSON.stringify({ title: 'x', calories: 'muitas', ingredients: [] }),
      schema,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors.some((message) => message.includes('calories'))).toBe(true);
    }
  });

  it('cita o caminho completo de campos aninhados', () => {
    const broken = { ...VALID, ingredients: [{ name: 'arroz', grams: -5 }] };
    const outcome = parseStructuredOutput(JSON.stringify(broken), schema);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors.some((message) => message.includes('ingredients.0.grams'))).toBe(true);
    }
  });

  it('não extrai JSON de texto com lixo ao redor (sem regex — CR-03)', () => {
    const wrapped = `Aqui está a receita: ${JSON.stringify(VALID)} Espero ter ajudado!`;
    expect(parseStructuredOutput(wrapped, schema).ok).toBe(false);

    const fenced = '```json\n' + JSON.stringify(VALID) + '\n```';
    expect(parseStructuredOutput(fenced, schema).ok).toBe(false);
  });

  it('JSON válido mas que não é objeto, ou texto vazio, também é ok:false', () => {
    expect(parseStructuredOutput('null', schema).ok).toBe(false);
    expect(parseStructuredOutput('42', schema).ok).toBe(false);
    expect(parseStructuredOutput('', schema).ok).toBe(false);
  });
});

describe('formatSchemaErrors', () => {
  it('gera uma frase curta por problema, citando o caminho do campo', () => {
    const result = schema.safeParse({
      title: 1,
      calories: 'x',
      ingredients: [{ name: 'a', grams: 0 }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    const messages = formatSchemaErrors(result.error);

    expect(messages).toHaveLength(result.error.issues.length);
    expect(messages.length).toBeGreaterThanOrEqual(3);
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain('\n');
    }
    expect(messages.some((message) => message.includes('title'))).toBe(true);
    expect(messages.some((message) => message.includes('calories'))).toBe(true);
    expect(messages.some((message) => message.includes('ingredients.0.grams'))).toBe(true);
  });

  it('com algo que não é erro do Zod devolve a mensagem em uma lista', () => {
    expect(formatSchemaErrors(new Error('falhou feio'))).toEqual(['falhou feio']);
    expect(formatSchemaErrors('texto solto')).toEqual(['texto solto']);
  });
});

describe('runValidators', () => {
  const passing = (id: string): Validator<Recipe> => ({ id, validate: () => ({ ok: true }) });
  const failing = (id: string, error: string): Validator<Recipe> => ({
    id,
    validate: () => ({ ok: false, error }),
  });

  it('sem validators devolve lista vazia', () => {
    expect(runValidators(VALID, [])).toEqual([]);
  });

  it('todos passando devolve lista vazia', () => {
    expect(runValidators(VALID, [passing('a'), passing('b')])).toEqual([]);
  });

  it('devolve a mensagem de cada validator que falhou', () => {
    const errors = runValidators(VALID, [passing('a'), failing('b', 'calorias não batem')]);
    expect(errors).toEqual(['calorias não batem']);
  });

  it('roda todos os validators, não para no primeiro erro', () => {
    const errors = runValidators(VALID, [
      failing('a', 'erro A'),
      passing('b'),
      failing('c', 'erro C'),
    ]);
    expect(errors).toEqual(['erro A', 'erro C']);
  });

  it('repassa o dado recebido a cada validator', () => {
    const seen: Recipe[] = [];
    const spy: Validator<Recipe> = {
      id: 'spy',
      validate: (data) => {
        seen.push(data);
        return { ok: true };
      },
    };
    runValidators(VALID, [spy]);
    expect(seen).toEqual([VALID]);
  });
});
