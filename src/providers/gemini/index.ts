/**
 * [Passo 5 · Adaptador Gemini] `Provider` sobre a API do Gemini, via `fetch`.
 * Cumpre: ADR-008, ADR-003, ADR-009. Regras da session: 5, 11, 13. CR-03, CR-04.
 *
 * A chave (`apiKey`) vem do chamador (de `GEMINI_API_KEY`); o adaptador nunca a loga nem a inclui em mensagens de erro.
 * `fetch` é injetável para os testes (ADR-010).
 *
 * Treino — confirme endpoint, formato de requisição e suporte a schema nativo na documentação oficial:
 *  - converta `req.schema` (Zod) para o formato nativo de saída estruturada quando possível; se a conversão não
 *    for suportada para um schema, envie sem schema e deixe o pipeline validar (fallback — CR-03);
 *  - mapeie o uso de tokens para `Usage`;
 *  - falha de rede/HTTP/autenticação => `ProviderError` (regra 11), sem expor a chave.
 */
import type { Provider } from '../../core/types';

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
}

export function createGeminiProvider(options: GeminiProviderOptions): Provider {
  throw new Error('not implemented');
}
