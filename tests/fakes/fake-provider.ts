/**
 * [Passo 2 · Fake de Provider] Provider falso e roteirizado para testar o pipeline sem rede (ADR-010, regra 15).
 *
 * Treino: cada chamada a `generate` consome a próxima posição de `script`: `string` => devolve como `text`
 * (com `usage` fixo); `Error` => lança (use `ProviderError` para simular falha de infraestrutura). Registre cada
 * requisição em `calls` para os testes conferirem prompts/feedback de retry. Script esgotado => erro claro.
 */
import type { GenerateRequest, Provider } from '../../src/core/types';

export type FakeResponse = string | Error;

export interface FakeProvider extends Provider {
  readonly calls: GenerateRequest[];
}

export function createFakeProvider(script: readonly FakeResponse[]): FakeProvider {
  throw new Error('not implemented');
}
