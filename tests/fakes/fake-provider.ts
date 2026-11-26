/**
 * [Passo 2 · Fake de Provider] Provider falso e roteirizado para testar o pipeline sem rede (ADR-010, regra 15).
 *
 * Cada chamada a `generate` consome a próxima posição de `script`: `string` => devolve como `text` (com `usage`
 * fixo); `Error` => lança (use `ProviderError` para simular falha de infraestrutura). Cada requisição é registrada em
 * `calls`. Script esgotado => erro claro.
 */
import type { GenerateRequest, GenerateResult, Provider } from '../../src/core/types';

export type FakeResponse = string | Error;

export interface FakeProvider extends Provider {
  readonly calls: GenerateRequest[];
}

/** Uso devolvido em toda resposta de texto do fake. */
export const FAKE_USAGE = { inputTokens: 10, outputTokens: 5 } as const;

export function createFakeProvider(script: readonly FakeResponse[]): FakeProvider {
  const calls: GenerateRequest[] = [];
  let next = 0;
  return {
    id: 'fake-provider',
    calls,
    generate(req: GenerateRequest): Promise<GenerateResult> {
      calls.push(req);
      const response = script[next];
      next += 1;
      if (response === undefined) {
        return Promise.reject(
          new Error(
            `FakeProvider: script esgotado (${script.length} resposta(s) roteirizada(s), chamada ${next})`,
          ),
        );
      }
      if (response instanceof Error) {
        return Promise.reject(response);
      }
      return Promise.resolve({ text: response, usage: { ...FAKE_USAGE } });
    },
  };
}
