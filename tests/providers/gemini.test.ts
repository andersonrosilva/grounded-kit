// [Passo 5 · Gemini] Testes de `src/providers/gemini` com `fetch` falso (ADR-008, ADR-009, ADR-010; regras 5, 11, 13).
// Formatos conferidos na documentação do Gemini: POST .../v1beta/models/{modelo}:generateContent, chave no header
// `x-goog-api-key` (nunca na URL), corpo com `contents`, `systemInstruction` e `generationConfig`
// (`responseMimeType` + schema), resposta com `candidates[0].content.parts[0].text` e `usageMetadata`.
//
// Decisões documentadas aqui:
//  - Resposta sem `candidates` (ex.: bloqueada pelo provedor) vira ProviderError, nunca texto vazio como sucesso.
//  - Contagem de tokens ausente vira 0 em `Usage`.
//  - `generate` aceita `schema` mas, se o Zod não converte para JSON Schema (ex.: `z.date()`), envia sem schema.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ProviderError } from '../../src/core/errors';
import { createGeminiProvider } from '../../src/providers/gemini';
import { runProviderContract } from '../contract/provider.contract';
import { createFakeFetch, jsonResponse, type FakeFetchHandler } from '../fakes/fake-fetch';

runProviderContract('gemini', () =>
  createGeminiProvider({ apiKey: 'chave-de-teste', model: 'modelo-de-teste' }),
);

const API_KEY = 'CHAVE-SECRETA-123';
const MODEL = 'modelo-x';

const generateOk = (overrides: Record<string, unknown> = {}) =>
  jsonResponse({
    candidates: [
      { content: { parts: [{ text: '{"answer":"42"}' }], role: 'model' }, finishReason: 'STOP' },
    ],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34, totalTokenCount: 46 },
    ...overrides,
  });

function make(handler: FakeFetchHandler = () => generateOk()) {
  const fake = createFakeFetch(handler);
  const provider = createGeminiProvider({ apiKey: API_KEY, model: MODEL, fetch: fake.fetch });
  return { provider, calls: fake.calls };
}

type Body = {
  contents?: { parts?: { text?: string }[] }[];
  systemInstruction?: { parts?: { text?: string }[] };
  generationConfig?: Record<string, unknown>;
};

describe('createGeminiProvider', () => {
  it('expõe um id que identifica o adaptador', () => {
    expect(make().provider.id).toMatch(/gemini/i);
  });

  it('envia o modelo configurado (na URL) e o prompt', async () => {
    const { provider, calls } = make();

    await provider.generate({ prompt: 'olá', system: 'seja breve' });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    );
    expect(calls[0]?.init.method).toBe('POST');
    const body = calls[0]?.body as Body;
    expect(body.contents?.[0]?.parts?.[0]?.text).toBe('olá');
    expect(body.systemInstruction?.parts?.[0]?.text).toBe('seja breve');
  });

  it('envia a chave no header x-goog-api-key e nunca na URL', async () => {
    const { provider, calls } = make();

    await provider.generate({ prompt: 'x' });

    expect(new Headers(calls[0]?.init.headers).get('x-goog-api-key')).toBe(API_KEY);
    expect(calls[0]?.url).not.toContain(API_KEY);
  });

  it('envia a temperatura em generationConfig quando informada', async () => {
    const { provider, calls } = make();
    await provider.generate({ prompt: 'x', temperature: 0.3 });
    expect((calls[0]?.body as Body).generationConfig).toMatchObject({ temperature: 0.3 });
  });

  it('converte o schema Zod para o formato nativo de saída estruturada', async () => {
    const { provider, calls } = make();

    await provider.generate({ prompt: 'x', schema: z.object({ answer: z.string() }) });

    const config = (calls[0]?.body as Body).generationConfig ?? {};
    expect(config.responseMimeType).toBe('application/json');
    const nativeSchema = config.responseJsonSchema ?? config.responseSchema;
    expect(nativeSchema).toBeDefined();
    expect(JSON.stringify(nativeSchema)).toContain('answer');
  });

  it('sem suporte ao schema, envia sem schema (fallback) e o pipeline valida', async () => {
    const { provider, calls } = make();

    const result = await provider.generate({ prompt: 'x', schema: z.object({ quando: z.date() }) });

    const config = (calls[0]?.body as Body).generationConfig ?? {};
    expect(config).not.toHaveProperty('responseJsonSchema');
    expect(config).not.toHaveProperty('responseSchema');
    expect(result.text).toBe('{"answer":"42"}');
  });

  it('sem schema nenhum, não envia schema', async () => {
    const { provider, calls } = make();
    await provider.generate({ prompt: 'x' });
    const config = (calls[0]?.body as Body).generationConfig ?? {};
    expect(config).not.toHaveProperty('responseJsonSchema');
    expect(config).not.toHaveProperty('responseSchema');
  });

  it('devolve o texto do primeiro candidato e mapeia o uso de tokens para Usage', async () => {
    const { provider } = make();

    const result = await provider.generate({ prompt: 'x' });

    expect(result.text).toBe('{"answer":"42"}');
    expect(result.usage).toMatchObject({ inputTokens: 12, outputTokens: 34 });
  });

  it('contagem de tokens ausente vira 0', async () => {
    const { provider } = make(() => generateOk({ usageMetadata: undefined }));
    const result = await provider.generate({ prompt: 'x' });
    expect(result.usage).toMatchObject({ inputTokens: 0, outputTokens: 0 });
  });

  it('resposta sem candidates vira ProviderError (nunca texto vazio como sucesso)', async () => {
    const { provider } = make(() => jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(provider.generate({ prompt: 'x' })).rejects.toBeInstanceOf(ProviderError);
  });

  it('HTTP não-2xx vira ProviderError com o status, sem chave nem corpo da resposta', async () => {
    const { provider } = make(() =>
      jsonResponse({ error: { message: `chave ${API_KEY} inválida` } }, 403),
    );

    const error = await provider.generate({ prompt: 'x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    const providerError = error as ProviderError;
    expect(providerError.providerId).toBe(provider.id);
    expect(providerError.message).toContain('403');
    expect(providerError.message).not.toContain(API_KEY);
  });

  it('a chave de API nunca aparece em mensagens de erro, nem de falha de rede (CR-04)', async () => {
    const { provider } = make(() => {
      throw new TypeError(`fetch failed: https://exemplo?key=${API_KEY}`);
    });

    const error = await provider.generate({ prompt: 'x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).message).not.toContain(API_KEY);
  });

  it('repassa o AbortSignal ao fetch e rejeita quando já está abortado', async () => {
    const { provider, calls } = make();
    const controller = new AbortController();

    await provider.generate({ prompt: 'x', signal: controller.signal });
    expect(calls[0]?.init.signal).toBe(controller.signal);

    controller.abort();
    await expect(provider.generate({ prompt: 'x', signal: controller.signal })).rejects.toThrow();
  });
});
