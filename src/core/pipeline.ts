/**
 * [Passo 2 · Pipeline] Orquestra retrieve → generate → validate → moderate e devolve ok | blocked | invalid.
 * Cumpre: ADR-006 (síncrono, sem streaming), ADR-003, ADR-007 (tracer), ADR-001.
 * Regras da session: 4–8, 10, 11, 12. CR-03: nada sai sem passar pelo schema.
 *
 * `index` (indexar a base do pack) é feito à parte por `retrieval/knowledge.indexKnowledge` — é a fase de
 * "ingestão"; `run` é a fase de consulta.
 */
import type { Embeddings, VectorStore } from '../retrieval/types';
import type { DomainPack } from './pack';
import type { Provider, RunResult, Tracer } from './types';

export interface PipelineDeps {
  provider: Provider;
  /** Sem `embeddings` + `store`, o retrieve é pulado e a lista de exemplos fica vazia (regra 10). */
  embeddings?: Embeddings;
  store?: VectorStore;
  /** Padrão: tracer no-op (`ops/tracer.createNoopTracer`). */
  tracer?: Tracer;
  /** Tentativas de generate+validate. Padrão 3 (regra 6). */
  maxAttempts?: number;
  /** Itens recuperados por consulta. Padrão 3. */
  topK?: number;
}

export interface Pipeline {
  run<TIn, TOut>(pack: DomainPack<TIn, TOut>, input: TIn): Promise<RunResult<TOut>>;
}

export function createPipeline(deps: PipelineDeps): Pipeline {
  // Roteiro de `run(pack, input)` — implemente nesta ordem:
  //  1. PRE: `runGuardrails(pack.guardrails, 'pre', { input })`; se `block` => `blocked` SEM chamar o provider (regra 7).
  //  2. RETRIEVE: `retrieveExamples(...)` se houver knowledge + embeddings + store; senão `[]` (regra 10).
  //  3. Laço de 1..maxAttempts (regra 6):
  //       a. `buildPrompt({ pack, input, examples, previousErrors })`
  //       b. `provider.generate({ system, prompt, schema: pack.outputSchema })`
  //          — erro de infraestrutura propaga como `ProviderError` e NÃO consome tentativa (regra 11)
  //       c. VALIDATE: `parseStructuredOutput(text, pack.outputSchema)` e depois `runValidators(...)`
  //       d. se houver erros: guarde-os para o próximo `previousErrors` e continue o laço
  //  4. Esgotou as tentativas => `{ status: 'invalid', errors, attempts }`.
  //  5. MODERATE: `runGuardrails(pack.guardrails, 'post', { input, output })`
  //       - `block`  => `blocked` (sem conteúdo parcial — regra 7)
  //       - `modify` => REVALIDE (schema + validators); falhou => `invalid` (regra 8)
  //       - `allow`  => `{ status: 'ok', data, usage }`
  //  6. Emita eventos no tracer a cada etapa, SEM conteúdo de prompt/resposta (regra 12).
  throw new Error('not implemented');
}
