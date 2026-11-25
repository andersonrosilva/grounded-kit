/**
 * [Passo 5 · Adaptador Ollama] `Provider` (geração) e `Embeddings` sobre o servidor Ollama local, via `fetch`.
 * Cumpre: ADR-008 (padrão local, custo zero), ADR-003, ADR-009. Regras da session: 11, 16. CR-04.
 *
 * O NOME DO MODELO É CONFIGURAÇÃO OBRIGATÓRIA (sem padrão embutido). `host` vem do chamador (de `OLLAMA_HOST`).
 * `fetch` é injetável para os testes usarem um falso (sem rede — ADR-010).
 *
 * Treino — confirme endpoints e formatos na documentação oficial do Ollama antes de escrever:
 *  - `generate`: POST de geração; se o servidor suportar saída estruturada por schema, converta `req.schema`; senão
 *    ignore-o (o pipeline valida por Zod de qualquer forma). Mapeie contagem de tokens para `Usage`.
 *  - falha de rede/HTTP => lance `ProviderError` (regra 11), nunca devolva texto vazio como se fosse sucesso.
 *  - `createOllamaEmbeddings`: `dimensions` é informado pelo chamador e deve ser conferido na primeira resposta.
 */
import type { Provider } from '../../core/types';
import type { Embeddings } from '../../retrieval/types';

export interface OllamaProviderOptions {
  host: string;
  model: string;
  fetch?: typeof fetch;
}

export interface OllamaEmbeddingsOptions {
  host: string;
  model: string;
  /** Dimensão do vetor do modelo escolhido; o índice depende dela (regra 16). */
  dimensions: number;
  fetch?: typeof fetch;
}

export function createOllamaProvider(options: OllamaProviderOptions): Provider {
  throw new Error('not implemented');
}

export function createOllamaEmbeddings(options: OllamaEmbeddingsOptions): Embeddings {
  throw new Error('not implemented');
}
