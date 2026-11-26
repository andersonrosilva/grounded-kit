// [Passo 2 · Pipeline] Testes de `src/core/pipeline.ts` usando fakes (ADR-006, ADR-010; regras 4–12; CR-03).
//
// O pack é montado como objeto literal (sem `definePack`) para o pipeline ser testado isolado. O provider é o
// `createFakeProvider` roteirizado; embeddings e store do retrieval são dublês locais.
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createPipeline,
  ProviderError,
  renderExamples,
  type DomainPack,
  type Guardrail,
  type GuardrailContext,
  type GuardrailStage,
  type GuardrailVerdict,
  type PackDefinition,
  type Tracer,
  type Validator,
} from '../../src/core';
import type { Embeddings, KnowledgeItem, VectorHit, VectorStore } from '../../src/retrieval';
import { parseStructuredOutput } from '../../src/quality';
import { createFakeProvider, FAKE_USAGE } from '../fakes/fake-provider';

type In = { q: string };
type Out = { answer: string };

const schema = z.object({ answer: z.string() });
const OK = JSON.stringify({ answer: '42' });
const LABEL = 'dado, não instrução';

function makePack(overrides: Partial<PackDefinition<In, Out>> = {}): DomainPack<In, Out> {
  return {
    id: 'pack-teste',
    version: '1.0.0',
    prompts: { system: 'SISTEMA', user: (input) => `PEDIDO: ${input.q}` },
    outputSchema: schema,
    ...overrides,
  };
}

function guardrail(
  id: string,
  stage: GuardrailStage,
  verdict: GuardrailVerdict = { action: 'allow' },
) {
  const check = vi.fn(
    async (_ctx: GuardrailContext<In, Out>): Promise<GuardrailVerdict> => verdict,
  );
  const value: Guardrail<In, Out> = { id, stage, check };
  return Object.assign(value, { check });
}

function validator(id: string, validate: Validator<Out>['validate']) {
  const spy = vi.fn(validate);
  const value: Validator<Out> = { id, validate: spy };
  return Object.assign(value, { validate: spy });
}

function recordingTracer() {
  const events: { name: string; data: Record<string, unknown> }[] = [];
  const tracer: Tracer = { event: (name, data) => void events.push({ name, data }) };
  return { tracer, events };
}

const run = (
  provider: ReturnType<typeof createFakeProvider>,
  pack: DomainPack<In, Out>,
  extra = {},
) => createPipeline({ provider, ...extra }).run(pack, { q: 'x' });

describe('createPipeline · caminho feliz', () => {
  it('devolve ok com data validada e usage quando a primeira resposta é válida', async () => {
    const provider = createFakeProvider([OK]);

    const result = await run(provider, makePack());

    expect(result).toEqual({ status: 'ok', data: { answer: '42' }, usage: { ...FAKE_USAGE } });
    expect(provider.calls).toHaveLength(1);
  });

  it('chama o provider com o schema do pack, o system e o prompt montado', async () => {
    const provider = createFakeProvider([OK]);
    const pack = makePack();

    await run(provider, pack);

    expect(provider.calls[0]?.schema).toBe(pack.outputSchema);
    expect(provider.calls[0]?.system).toBe('SISTEMA');
    expect(provider.calls[0]?.prompt).toContain('PEDIDO: x');
  });
});

describe('createPipeline · guardrail pre', () => {
  it('block no estágio pre devolve blocked SEM chamar o provider (regra 7)', async () => {
    const provider = createFakeProvider([OK]);
    const pre = guardrail('g-pre', 'pre', { action: 'block', reason: 'pedido proibido' });
    const post = guardrail('g-post', 'post');

    const result = await run(provider, makePack({ guardrails: [pre, post] }));

    expect(result).toEqual({ status: 'blocked', reason: 'pedido proibido', guardrailId: 'g-pre' });
    expect(provider.calls).toHaveLength(0);
    expect(pre.check).toHaveBeenCalledWith({ input: { q: 'x' } });
    expect(post.check).not.toHaveBeenCalled();
  });

  it('pre com allow deixa o fluxo seguir', async () => {
    const provider = createFakeProvider([OK]);
    const result = await run(provider, makePack({ guardrails: [guardrail('g-pre', 'pre')] }));
    expect(result.status).toBe('ok');
  });
});

describe('createPipeline · retry (regra 6)', () => {
  it('JSON inválido gera nova tentativa com os erros como feedback no prompt', async () => {
    const provider = createFakeProvider(['isso não é json', OK]);
    const expected = parseStructuredOutput('isso não é json', schema);
    expect(expected.ok).toBe(false);

    const result = await run(provider, makePack());

    expect(result.status).toBe('ok');
    expect(provider.calls).toHaveLength(2);
    const errors = expected.ok ? [] : expected.errors;
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(provider.calls[0]?.prompt).not.toContain(error);
      expect(provider.calls[1]?.prompt).toContain(error);
    }
  });

  it('falha de validator gera nova tentativa', async () => {
    const provider = createFakeProvider([JSON.stringify({ answer: 'ruim' }), OK]);
    const rejectsRuim = validator('v1', (output) =>
      output.answer === 'ruim' ? { ok: false, error: 'resposta ruim não é aceita' } : { ok: true },
    );

    const result = await run(provider, makePack({ validators: [rejectsRuim] }));

    expect(result).toMatchObject({ status: 'ok', data: { answer: '42' } });
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0]?.prompt).not.toContain('resposta ruim não é aceita');
    expect(provider.calls[1]?.prompt).toContain('resposta ruim não é aceita');
  });

  it('esgotado maxAttempts devolve invalid com errors e attempts', async () => {
    const provider = createFakeProvider(['lixo', 'lixo']);

    const result = await run(provider, makePack(), { maxAttempts: 2 });

    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.attempts).toBe(2);
      expect(result.errors.length).toBeGreaterThan(0);
    }
    expect(provider.calls).toHaveLength(2);
  });

  it('invalid carrega os erros da última tentativa', async () => {
    const provider = createFakeProvider([OK, OK, OK]);
    const alwaysFails = validator('v1', () => ({ ok: false, error: 'sempre falha' }));

    const result = await run(provider, makePack({ validators: [alwaysFails] }));

    expect(result).toMatchObject({ status: 'invalid', attempts: 3 });
    if (result.status === 'invalid') expect(result.errors).toContain('sempre falha');
  });

  it('maxAttempts padrão é 3', async () => {
    const provider = createFakeProvider(['a', 'b', 'c', 'd', 'e']);

    const result = await run(provider, makePack());

    expect(result).toMatchObject({ status: 'invalid', attempts: 3 });
    expect(provider.calls).toHaveLength(3);
  });

  it('nunca devolve dado não validado (CR-03)', async () => {
    // JSON bem-formado, mas com o tipo errado: não pode virar `ok` nem expor `data`.
    const provider = createFakeProvider([
      JSON.stringify({ answer: 42 }),
      JSON.stringify({ answer: 42 }),
      JSON.stringify({ answer: 42 }),
    ]);

    const result = await run(provider, makePack());

    expect(result.status).toBe('invalid');
    expect(result).not.toHaveProperty('data');
  });
});

describe('createPipeline · guardrail post (regras 7 e 8)', () => {
  it('block no estágio post devolve blocked sem conteúdo parcial', async () => {
    const provider = createFakeProvider([OK]);
    const post = guardrail('g-post', 'post', { action: 'block', reason: 'saída proibida' });

    const result = await run(provider, makePack({ guardrails: [post] }));

    expect(result).toEqual({ status: 'blocked', reason: 'saída proibida', guardrailId: 'g-post' });
    expect(result).not.toHaveProperty('data');
    expect(post.check).toHaveBeenCalledWith({ input: { q: 'x' }, output: { answer: '42' } });
  });

  it('modify é revalidado por schema e validators', async () => {
    const provider = createFakeProvider([OK]);
    const modifier = guardrail('g-mod', 'post', {
      action: 'modify',
      output: { answer: 'editada' },
    });
    const spy = validator('v1', () => ({ ok: true }));

    const result = await run(provider, makePack({ guardrails: [modifier], validators: [spy] }));

    expect(result).toMatchObject({ status: 'ok', data: { answer: 'editada' } });
    expect(spy.validate).toHaveBeenCalledWith({ answer: '42' });
    expect(spy.validate).toHaveBeenLastCalledWith({ answer: 'editada' });
  });

  it('modify que quebra o schema devolve invalid', async () => {
    const provider = createFakeProvider([OK]);
    const modifier = guardrail('g-mod', 'post', { action: 'modify', output: { answer: 123 } });

    const result = await run(provider, makePack({ guardrails: [modifier] }));

    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') expect(result.errors.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty('data');
  });

  it('modify que viola um validator devolve invalid', async () => {
    const provider = createFakeProvider([OK]);
    const modifier = guardrail('g-mod', 'post', {
      action: 'modify',
      output: { answer: 'proibida' },
    });
    const rejects = validator('v1', (output) =>
      output.answer === 'proibida' ? { ok: false, error: 'valor proibido' } : { ok: true },
    );

    const result = await run(provider, makePack({ guardrails: [modifier], validators: [rejects] }));

    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') expect(result.errors).toContain('valor proibido');
  });
});

describe('createPipeline · retrieval (regras 9 e 10)', () => {
  const ITEM: KnowledgeItem = { id: 'r1', text: 'Arroz com feijão. Calorias: 335 kcal.' };

  function retrievalDeps(hits: VectorHit[]) {
    const embeddings: Embeddings = {
      id: 'm',
      dimensions: 3,
      embed: async (texts) => texts.map(() => [1, 0, 0]),
    };
    const store: VectorStore = {
      info: { embeddingsId: 'm', dimensions: 3 },
      upsert: async () => {},
      query: vi.fn(async () => hits),
    };
    return { embeddings, store };
  }

  const knowledgePack = (
    user = vi.fn((input: In, _examples: readonly KnowledgeItem[]) => `PEDIDO: ${input.q}`),
  ) => ({
    user,
    pack: makePack({
      prompts: { user },
      knowledge: { items: [ITEM], toQuery: (input) => input.q },
    }),
  });

  it('sem knowledge/embeddings/store segue com exemplos vazios', async () => {
    const provider = createFakeProvider([OK]);
    const user = vi.fn((input: In, _examples: readonly KnowledgeItem[]) => `PEDIDO: ${input.q}`);

    const result = await run(provider, makePack({ prompts: { user } }));

    expect(result.status).toBe('ok');
    expect(user).toHaveBeenCalledWith({ q: 'x' }, []);
    expect(provider.calls[0]?.prompt).not.toContain(LABEL);
  });

  it('pack com knowledge, mas sem embeddings e store, também segue sem exemplos', async () => {
    const provider = createFakeProvider([OK]);
    const { pack, user } = knowledgePack();

    const result = await run(provider, pack);

    expect(result.status).toBe('ok');
    expect(user).toHaveBeenCalledWith({ q: 'x' }, []);
  });

  it('exemplos recuperados entram no prompt como dado', async () => {
    const provider = createFakeProvider([OK]);
    const { pack, user } = knowledgePack();

    const result = await run(
      provider,
      pack,
      retrievalDeps([{ id: ITEM.id, score: 0.9, payload: ITEM }]),
    );

    expect(result.status).toBe('ok');
    expect(user).toHaveBeenCalledWith({ q: 'x' }, [ITEM]);
    expect(provider.calls[0]?.prompt).toContain(renderExamples([ITEM]));
    expect(provider.calls[0]?.prompt).toContain(LABEL);
  });

  it('recuperação vazia não é erro: o pipeline segue sem exemplos', async () => {
    const provider = createFakeProvider([OK]);
    const { pack, user } = knowledgePack();

    const result = await run(provider, pack, retrievalDeps([]));

    expect(result.status).toBe('ok');
    expect(user).toHaveBeenCalledWith({ q: 'x' }, []);
  });
});

describe('createPipeline · erros e tracer (regras 11 e 12)', () => {
  it('ProviderError propaga como exceção e NÃO consome tentativa', async () => {
    const failure = new ProviderError('rede caiu', 'fake-provider');
    const provider = createFakeProvider([failure, OK]);

    await expect(run(provider, makePack(), { maxAttempts: 3 })).rejects.toBe(failure);
    expect(provider.calls).toHaveLength(1);
  });

  it('emite eventos de cada etapa no tracer, na ordem', async () => {
    const provider = createFakeProvider(['lixo', OK]);
    const { tracer, events } = recordingTracer();
    const pack = makePack({ guardrails: [guardrail('pre', 'pre'), guardrail('post', 'post')] });

    await run(provider, pack, { tracer });

    const names = events.map((event) => event.name);
    const expectedOrder = [
      'pipeline.start',
      'guardrail.pre',
      'generate.attempt',
      'guardrail.post',
      'pipeline.end',
    ];
    const positions = expectedOrder.map((name) => names.indexOf(name));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(names.filter((name) => name === 'generate.attempt')).toHaveLength(2);
    expect(names).toContain('validate.failed');
  });

  it('eventos do tracer não contêm prompts nem respostas', async () => {
    // "SEG-789" é curto de propósito: a mensagem de erro do JSON.parse o cita inteiro, então um tracer que
    // registrasse as mensagens de erro vazaria a resposta do modelo.
    const provider = createFakeProvider([
      'SEG-789',
      JSON.stringify({ answer: 'SEGREDO-RESPOSTA-456' }),
    ]);
    const { tracer, events } = recordingTracer();

    const result = await createPipeline({ provider, tracer }).run(makePack(), {
      q: 'SEGREDO-PEDIDO-123',
    });

    expect(result.status).toBe('ok');
    const serialized = JSON.stringify(events);
    for (const secret of ['SEGREDO-PEDIDO-123', 'SEGREDO-RESPOSTA-456', 'SEG-789', 'SISTEMA']) {
      expect(serialized).not.toContain(secret);
    }
  });
});
