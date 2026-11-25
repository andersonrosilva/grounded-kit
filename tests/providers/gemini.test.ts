// [Passo 5 · Gemini] Testes de `src/providers/gemini` com `fetch` falso (ADR-008, ADR-009, ADR-010; regras 5, 11, 13).
import { describe, it } from 'vitest';
import { createGeminiProvider } from '../../src/providers/gemini';
import { runProviderContract } from '../contract/provider.contract';

runProviderContract('gemini', () => createGeminiProvider({ apiKey: 'chave-de-teste', model: 'modelo-de-teste' }));

describe('createGeminiProvider', () => {
  it.todo('envia o modelo configurado e o prompt');
  it.todo('converte o schema Zod para o formato nativo de saída estruturada');
  it.todo('sem suporte ao schema, envia sem schema (fallback) e o pipeline valida');
  it.todo('mapeia o uso de tokens para Usage');
  it.todo('HTTP não-2xx vira ProviderError');
  it.todo('a chave de API nunca aparece em mensagens de erro (CR-04)');
});
