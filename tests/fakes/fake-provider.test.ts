// [Passo 2 · Fake de Provider] Testes de `tests/fakes/fake-provider.ts` (ADR-010, regra 15).
// O contrato `runProviderContract` NÃO é chamado aqui: ele exige falha de rede e `AbortSignal`, que só fazem sentido
// para adaptadores reais (Ollama, Gemini).
import { describe, expect, it } from 'vitest';
import { ProviderError } from '../../src/core/errors';
import { createFakeProvider } from './fake-provider';

describe('createFakeProvider', () => {
  it('expõe um id não vazio', () => {
    expect(createFakeProvider([]).id.length).toBeGreaterThan(0);
  });

  it('devolve as respostas do script na ordem, como text com usage fixo', async () => {
    const provider = createFakeProvider(['primeira', 'segunda']);

    const first = await provider.generate({ prompt: 'a' });
    const second = await provider.generate({ prompt: 'b' });

    expect(first.text).toBe('primeira');
    expect(second.text).toBe('segunda');
    expect(first.usage).toEqual({
      inputTokens: expect.any(Number),
      outputTokens: expect.any(Number),
    });
    expect(second.usage).toEqual(first.usage);
  });

  it('lança o Error do script (um ProviderError simula falha de infraestrutura)', async () => {
    const failure = new ProviderError('rede caiu', 'fake-provider');
    const provider = createFakeProvider([failure, 'depois']);

    await expect(provider.generate({ prompt: 'a' })).rejects.toBe(failure);
    expect((await provider.generate({ prompt: 'b' })).text).toBe('depois');
  });

  it('registra cada requisição em calls, na ordem (inclusive a que falhou)', async () => {
    const provider = createFakeProvider([new Error('falha'), 'ok']);
    const first = { prompt: 'um', system: 'sistema' };
    const second = { prompt: 'dois' };

    await provider.generate(first).catch(() => undefined);
    await provider.generate(second);

    expect(provider.calls).toEqual([first, second]);
  });

  it('script esgotado lança erro claro', async () => {
    const provider = createFakeProvider(['única']);
    await provider.generate({ prompt: 'a' });

    await expect(provider.generate({ prompt: 'b' })).rejects.toThrow(/script/i);
  });
});
