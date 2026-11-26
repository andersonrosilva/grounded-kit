// [Passo 6 · Pack de exemplo Receitas/Nutrição] Testes de `examples/nutrition-pack/pack.ts` (CR-02, CR-03; critério 7).
// A política (restrições alimentares) mora SÓ aqui, no pack; o core não conhece nada disso (CR-01/CR-02).
//
// Decisões documentadas aqui (o stub dizia "tolerância à sua escolha"):
//  - Calorias declaradas valem se ficarem a até 10% da soma `gramas x kcal/100 g` pela tabela sintética.
//  - Ingrediente que não está na tabela reprova a validação (não dá para conferir as calorias).
//  - Schema: `title` não vazio, `ingredients` e `steps` com ao menos 1 item, `grams` > 0 e `calories` >= 0.
//  - Alérgenos declarados pelo usuário são normalizados (minúsculas, sem acento) antes de comparar.
import { describe, expect, it } from 'vitest';
import { createPipeline } from '../../src/core';
import type { Guardrail, GuardrailStage, GuardrailVerdict } from '../../src/core/types';
import { getKnowledgeItems } from '../../examples/nutrition-pack/data';
import {
  createNutritionOutputSchema,
  createNutritionPack,
  type NutritionInput,
  type NutritionOutput,
} from '../../examples/nutrition-pack/pack';
import { createFakeProvider } from '../fakes/fake-provider';

// arroz branco cozido 150 g x 130 + feijão carioca cozido 100 g x 80 = 195 + 80 = 275 kcal.
const VALID: NutritionOutput = {
  title: 'Arroz com feijão',
  ingredients: [
    { name: 'arroz branco cozido', grams: 150 },
    { name: 'feijao carioca cozido', grams: 100 },
  ],
  calories: 275,
  steps: ['Cozinhe o arroz.', 'Aqueça o feijão e sirva.'],
};

const withAmendoim: NutritionOutput = {
  title: 'Panqueca',
  ingredients: [{ name: 'pasta de amendoim', grams: 15 }],
  calories: 89, // 15 x 5,9 = 88,5
  steps: ['Misture.'],
};

const input = (request: string, allergens: string[] = []): NutritionInput => ({
  request,
  allergens,
});

/** Roda os guardrails de um estágio em ordem e devolve o primeiro veredito que não é `allow`. */
async function verdictOf(
  stage: GuardrailStage,
  ctx: { input: NutritionInput; output?: NutritionOutput },
): Promise<GuardrailVerdict & { guardrailId?: string }> {
  const pack = createNutritionPack();
  const guardrails = (pack.guardrails ?? []).filter((g) => g.stage === stage) as Guardrail<
    NutritionInput,
    NutritionOutput
  >[];
  for (const guardrail of guardrails) {
    const verdict = await guardrail.check(ctx);
    if (verdict.action !== 'allow') return { ...verdict, guardrailId: guardrail.id };
  }
  return { action: 'allow' };
}

function failures(output: NutritionOutput): string[] {
  const pack = createNutritionPack();
  return (pack.validators ?? []).flatMap((validator) => {
    const result = validator.validate(output);
    return result.ok ? [] : [result.error];
  });
}

describe('createNutritionOutputSchema', () => {
  const schema = createNutritionOutputSchema();

  it('aceita uma receita completa', () => {
    expect(schema.safeParse(VALID).success).toBe(true);
  });

  it('recusa campos ausentes ou de tipo errado', () => {
    expect(schema.safeParse({ ...VALID, title: '' }).success).toBe(false);
    expect(schema.safeParse({ ...VALID, calories: 'muitas' }).success).toBe(false);
    expect(schema.safeParse({ ...VALID, steps: 'misture' }).success).toBe(false);
    expect(schema.safeParse({ ...VALID, title: undefined }).success).toBe(false);
  });

  it('recusa gramas não positivas, calorias negativas e listas vazias', () => {
    expect(schema.safeParse({ ...VALID, ingredients: [{ name: 'arroz', grams: 0 }] }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({ ...VALID, ingredients: [{ name: 'arroz', grams: -5 }] }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...VALID, calories: -1 }).success).toBe(false);
    expect(schema.safeParse({ ...VALID, ingredients: [] }).success).toBe(false);
    expect(schema.safeParse({ ...VALID, steps: [] }).success).toBe(false);
  });
});

describe('createNutritionPack · definição', () => {
  const pack = createNutritionPack();

  it('tem id e version e usa o schema de saída do pack', () => {
    expect(pack.id.length).toBeGreaterThan(0);
    expect(pack.version.length).toBeGreaterThan(0);
    expect(pack.outputSchema.safeParse(VALID).success).toBe(true);
    expect(pack.outputSchema.safeParse({ title: 1 }).success).toBe(false);
  });

  it('a base de conhecimento são as receitas sintéticas de data.ts', () => {
    expect(pack.knowledge?.items).toEqual(getKnowledgeItems());
    expect(pack.knowledge?.toQuery(input('quero algo com atum'))).toContain('atum');
  });

  it('o prompt do usuário pede JSON, traz o pedido e usa os exemplos', () => {
    const examples = getKnowledgeItems().slice(0, 2);

    const prompt = pack.prompts.user(input('quero algo leve com frango', ['leite']), examples);

    expect(prompt).toContain('quero algo leve com frango');
    expect(prompt).toMatch(/json/i);
    expect(pack.prompts.system?.length ?? 0).toBeGreaterThan(0);
  });

  it('tem ao menos um guardrail pre e um post, e um validator de calorias', () => {
    const stages = (pack.guardrails ?? []).map((guardrail) => guardrail.stage);
    expect(stages).toContain('pre');
    expect(stages).toContain('post');
    expect((pack.validators ?? []).length).toBeGreaterThan(0);
  });
});

describe('createNutritionPack · guardrail pre (pedido × alérgeno declarado)', () => {
  it('bloqueia quando o pedido menciona um alérgeno declarado', async () => {
    const verdict = await verdictOf('pre', {
      input: input('receita com pasta de amendoim', ['amendoim']),
    });

    expect(verdict.action).toBe('block');
    if (verdict.action === 'block') expect(verdict.reason.length).toBeGreaterThan(0);
  });

  it('normaliza maiúsculas e acentos dos dois lados', async () => {
    const verdict = await verdictOf('pre', {
      input: input('QUERO UM PÃO COM GLÚTEN', ['  Glúten ']),
    });
    expect(verdict.action).toBe('block');
  });

  it('permite quando o pedido não menciona o alérgeno', async () => {
    expect(
      await verdictOf('pre', { input: input('receita com arroz e feijão', ['amendoim']) }),
    ).toEqual({
      action: 'allow',
    });
  });

  it('permite quando o usuário não declarou alérgenos', async () => {
    expect(await verdictOf('pre', { input: input('receita com pasta de amendoim') })).toEqual({
      action: 'allow',
    });
  });
});

describe('createNutritionPack · guardrail post (receita × alérgeno declarado)', () => {
  it('bloqueia quando a receita contém ingrediente com alérgeno declarado', async () => {
    const verdict = await verdictOf('post', {
      input: input('algo doce', ['amendoim']),
      output: withAmendoim,
    });
    expect(verdict.action).toBe('block');
  });

  it('o mapa de alérgenos vem da tabela (queijo minas frescal contém leite)', async () => {
    const output: NutritionOutput = {
      title: 'Tapioca',
      ingredients: [{ name: 'queijo minas frescal', grams: 40 }],
      calories: 104,
      steps: ['Recheie.'],
    };
    const verdict = await verdictOf('post', { input: input('algo rápido', ['Leite']), output });
    expect(verdict.action).toBe('block');
  });

  it('permite quando nenhum ingrediente tem o alérgeno declarado', async () => {
    expect(
      await verdictOf('post', { input: input('algo simples', ['amendoim']), output: VALID }),
    ).toEqual({
      action: 'allow',
    });
  });

  it('permite quando o usuário não declarou alérgenos', async () => {
    expect(await verdictOf('post', { input: input('algo doce'), output: withAmendoim })).toEqual({
      action: 'allow',
    });
  });
});

describe('createNutritionPack · validator de calorias', () => {
  it('aprova calorias iguais à soma pela tabela', () => {
    expect(failures(VALID)).toEqual([]);
  });

  it('aprova calorias dentro da tolerância de 10%', () => {
    expect(failures({ ...VALID, calories: 290 })).toEqual([]);
    expect(failures({ ...VALID, calories: 260 })).toEqual([]);
  });

  it('reprova calorias fora da tolerância, com mensagem que cita as calorias', () => {
    const errors = failures({ ...VALID, calories: 500 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toMatch(/calor/i);
  });

  it('reprova ingrediente que não está na tabela', () => {
    const errors = failures({
      ...VALID,
      ingredients: [{ name: 'ingrediente inexistente', grams: 100 }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('createNutritionPack · de ponta a ponta com o pipeline (provider falso)', () => {
  const json = (output: unknown) => JSON.stringify(output);

  it('pedido sem restrição e receita válida devolve ok', async () => {
    const provider = createFakeProvider([json(VALID)]);

    const result = await createPipeline({ provider }).run(
      createNutritionPack(),
      input('quero arroz com feijão'),
    );

    expect(result).toMatchObject({
      status: 'ok',
      data: { title: 'Arroz com feijão', calories: 275 },
    });
  });

  it('pedido com alérgeno declarado é bloqueado sem chamar o modelo', async () => {
    const provider = createFakeProvider([json(VALID)]);

    const result = await createPipeline({ provider }).run(
      createNutritionPack(),
      input('receita com pasta de amendoim', ['amendoim']),
    );

    expect(result.status).toBe('blocked');
    expect(provider.calls).toHaveLength(0);
  });

  it('receita com alérgeno que o modelo introduziu é bloqueada na saída', async () => {
    const provider = createFakeProvider([json(withAmendoim)]);

    const result = await createPipeline({ provider }).run(
      createNutritionPack(),
      input('algo doce', ['amendoim']),
    );

    expect(result.status).toBe('blocked');
    expect(result).not.toHaveProperty('data');
  });

  it('calorias erradas disparam nova tentativa com feedback e depois passam', async () => {
    const provider = createFakeProvider([json({ ...VALID, calories: 900 }), json(VALID)]);

    const result = await createPipeline({ provider }).run(
      createNutritionPack(),
      input('quero arroz com feijão'),
    );

    expect(result.status).toBe('ok');
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1]?.prompt).toMatch(/calor/i);
  });
});
