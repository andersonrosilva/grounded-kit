/**
 * [Passo 2 · Contrato do port Provider] Suíte reutilizável: qualquer adaptador (fake, Ollama, Gemini) deve passar.
 * Cumpre: ADR-010 (testes de contrato), critério de aceite 8. Regras da session: 5, 11.
 */
import { describe, it } from 'vitest';
import type { Provider } from '../../src/core/types';

export function runProviderContract(name: string, makeProvider: () => Provider): void {
  describe(`contrato Provider · ${name}`, () => {
    it.todo('expõe um id não vazio');
    it.todo('generate devolve text e usage (tokens de entrada e saída)');
    it.todo('generate aceita schema opcional sem quebrar quando o provider não o suporta');
    it.todo('falha de infraestrutura (rede/HTTP/autenticação) vira ProviderError');
    it.todo('respeita AbortSignal');
  });
}
