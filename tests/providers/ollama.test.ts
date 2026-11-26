// [Passo 5 · Ollama] Testes de `src/providers/ollama` com `fetch` falso (ADR-008, ADR-010; regras 11, 16).
// Formatos conferidos na documentação do Ollama: POST /api/generate (`stream: false`, `format` = JSON Schema,
// resposta com `response`, `prompt_eval_count`, `eval_count`) e POST /api/embed (`input` lista, resposta `embeddings`).
//
// Decisões documentadas aqui:
//  - `host` com barra no final funciona (sem `//` na URL).
//  - Contagem de tokens ausente na resposta vira 0 em `Usage`.
//  - Resposta sem o campo `response` (ou que não é JSON) vira ProviderError; nunca texto vazio como sucesso.
//  - `generate` aceita `schema` mas ignora o que não consegue converter para JSON Schema (o pipeline valida de qualquer jeito).
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ProviderError } from '../../src/core/errors';
import { createOllamaEmbeddings, createOllamaProvider } from '../../src/providers/ollama';
import { runEmbeddingsContract } from '../contract/embeddings.contract';
import { runProviderContract } from '../contract/provider.contract';
import { createFakeFetch, jsonResponse, type FakeFetchHandler } from '../fakes/fake-fetch';

runProviderContract('ollama', () =>
  createOllamaProvider({ host: 'http://localhost', model: 'modelo-de-teste' }),
);
runEmbeddingsContract('ollama', () =>
  createOllamaEmbeddings({ host: 'http://localhost', model: 'modelo-de-teste', dimensions: 8 }),
);

const HOST = 'http://localhost:11434';
const MODEL = 'modelo-x';

const generateOk = (overrides: Record<string, unknown> = {}) =>
  jsonResponse({
    model: MODEL,
    response: '{"answer":"42"}',
    done: true,
    prompt_eval_count: 26,
    eval_count: 290,
    ...overrides,
  });

function makeProvider(handler: FakeFetchHandler = () => generateOk(), host = HOST) {
  const fake = createFakeFetch(handler);
  return {
    provider: createOllamaProvider({ host, model: MODEL, fetch: fake.fetch }),
    calls: fake.calls,
  };
}

/** Embeddings de `dimensions` posições para cada texto de `input`. */
const embedOk =
  (dimensions: number): FakeFetchHandler =>
  (call) => {
    const input = (call.body as { input: string[] }).input;
    return jsonResponse({
      model: MODEL,
      embeddings: input.map(() => new Array<number>(dimensions).fill(0.5)),
    });
  };

describe('createOllamaProvider', () => {
  it('expõe um id que identifica o adaptador', () => {
    expect(makeProvider().provider.id).toMatch(/ollama/i);
  });

  it('envia o modelo configurado e o prompt para o endpoint de geração', async () => {
    const { provider, calls } = makeProvider();

    await provider.generate({ prompt: 'olá', system: 'seja breve' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${HOST}/api/generate`);
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.body).toMatchObject({
      model: MODEL,
      prompt: 'olá',
      system: 'seja breve',
      stream: false,
    });
  });

  it('host com barra no final não gera URL com //', async () => {
    const { provider, calls } = makeProvider(() => generateOk(), `${HOST}/`);
    await provider.generate({ prompt: 'x' });
    expect(calls[0]?.url).toBe(`${HOST}/api/generate`);
  });

  it('envia a temperatura em options quando informada', async () => {
    const { provider, calls } = makeProvider();
    await provider.generate({ prompt: 'x', temperature: 0.2 });
    expect(calls[0]?.body).toMatchObject({ options: { temperature: 0.2 } });
  });

  it('converte o schema Zod para o formato nativo (JSON Schema em `format`)', async () => {
    const { provider, calls } = makeProvider();

    await provider.generate({ prompt: 'x', schema: z.object({ answer: z.string() }) });

    const body = calls[0]?.body as {
      format?: { type?: string; properties?: Record<string, unknown> };
    };
    expect(body.format?.type).toBe('object');
    expect(body.format?.properties).toHaveProperty('answer');
  });

  it('sem schema, ou com schema que não converte, envia sem `format` e não falha', async () => {
    const { provider, calls } = makeProvider();

    await provider.generate({ prompt: 'x' });
    await provider.generate({ prompt: 'x', schema: z.object({ quando: z.date() }) });

    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.body).not.toHaveProperty('format');
  });

  it('devolve o texto de `response` e mapeia a contagem de tokens para Usage', async () => {
    const { provider } = makeProvider();

    const result = await provider.generate({ prompt: 'x' });

    expect(result.text).toBe('{"answer":"42"}');
    expect(result.usage).toMatchObject({ inputTokens: 26, outputTokens: 290 });
  });

  it('contagem de tokens ausente vira 0', async () => {
    const { provider } = makeProvider(() => jsonResponse({ response: 'ok', done: true }));
    const result = await provider.generate({ prompt: 'x' });
    expect(result.usage).toMatchObject({ inputTokens: 0, outputTokens: 0 });
  });

  it('HTTP não-2xx vira ProviderError sem vazar dados sensíveis', async () => {
    const { provider } = makeProvider(() =>
      jsonResponse({ error: 'falha interna', debug: 'TOKEN-SECRETO' }, 500),
    );

    const error = await provider.generate({ prompt: 'x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    const providerError = error as ProviderError;
    expect(providerError.providerId).toBe(provider.id);
    expect(providerError.message).toContain('500');
    expect(providerError.message).not.toContain('TOKEN-SECRETO');
  });

  it('falha de rede vira ProviderError preservando a causa', async () => {
    const cause = new TypeError('fetch failed');
    const { provider } = makeProvider(() => {
      throw cause;
    });

    const error = await provider.generate({ prompt: 'x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).cause).toBe(cause);
  });

  it('resposta sem `response`, ou que não é JSON, vira ProviderError (nunca texto vazio como sucesso)', async () => {
    const semResponse = makeProvider(() => jsonResponse({ done: true })).provider;
    await expect(semResponse.generate({ prompt: 'x' })).rejects.toBeInstanceOf(ProviderError);

    const naoJson = makeProvider(() => new Response('<html>erro</html>', { status: 200 })).provider;
    await expect(naoJson.generate({ prompt: 'x' })).rejects.toBeInstanceOf(ProviderError);
  });

  it('repassa o AbortSignal ao fetch e rejeita quando já está abortado', async () => {
    const { provider, calls } = makeProvider();
    const controller = new AbortController();

    await provider.generate({ prompt: 'x', signal: controller.signal });
    expect(calls[0]?.init.signal).toBe(controller.signal);

    controller.abort();
    await expect(provider.generate({ prompt: 'x', signal: controller.signal })).rejects.toThrow();
  });
});

describe('createOllamaEmbeddings', () => {
  const make = (handler: FakeFetchHandler, dimensions = 8) => {
    const fake = createFakeFetch(handler);
    const embeddings = createOllamaEmbeddings({
      host: HOST,
      model: MODEL,
      dimensions,
      fetch: fake.fetch,
    });
    return { embeddings, calls: fake.calls };
  };

  it('o id do Embeddings inclui o nome do modelo (regra 16) e expõe as dimensões configuradas', () => {
    const { embeddings } = make(embedOk(8));
    expect(embeddings.id).toContain(MODEL);
    expect(embeddings.dimensions).toBe(8);
  });

  it('envia modelo e lista de textos para /api/embed e devolve um vetor por texto, na ordem', async () => {
    const { embeddings, calls } = make(embedOk(8));

    const vectors = await embeddings.embed(['arroz', 'feijão']);

    expect(calls[0]?.url).toBe(`${HOST}/api/embed`);
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.body).toMatchObject({ model: MODEL, input: ['arroz', 'feijão'] });
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(8);
  });

  it('lista vazia devolve lista vazia sem chamar o servidor', async () => {
    const { embeddings, calls } = make(embedOk(8));
    expect(await embeddings.embed([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('confere a dimensão devolvida com a dimensão configurada', async () => {
    const { embeddings } = make(embedOk(3), 8);
    const error = await embeddings.embed(['arroz']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).message).toMatch(/dimens/i);
  });

  it('quantidade de vetores diferente da de textos vira ProviderError', async () => {
    const { embeddings } = make(() => jsonResponse({ embeddings: [new Array<number>(8).fill(0)] }));
    await expect(embeddings.embed(['a', 'b'])).rejects.toBeInstanceOf(ProviderError);
  });

  it('HTTP não-2xx e falha de rede viram ProviderError', async () => {
    const http = make(() => jsonResponse({ error: 'x' }, 503));
    await expect(http.embeddings.embed(['a'])).rejects.toBeInstanceOf(ProviderError);

    const network = make(() => {
      throw new TypeError('fetch failed');
    });
    await expect(network.embeddings.embed(['a'])).rejects.toBeInstanceOf(ProviderError);
  });
});
