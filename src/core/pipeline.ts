/**
 * [Passo 2 · Pipeline] Orquestra retrieve → generate → validate → moderate e devolve ok | blocked | invalid.
 * Cumpre: ADR-006 (síncrono, sem streaming), ADR-003, ADR-007 (tracer), ADR-001.
 * Regras da session: 4–8, 10, 11, 12. CR-03: nada sai sem passar pelo schema.
 *
 * `index` (indexar a base do pack) é feito à parte por `retrieval/knowledge.indexKnowledge` — é a fase de
 * "ingestão"; `run` é a fase de consulta.
 */
import { formatSchemaErrors, parseStructuredOutput, runGuardrails, runValidators } from '../quality';
import { createNoopTracer } from '../ops';
import { retrieveExamples } from '../retrieval';
import type { Embeddings, VectorStore } from '../retrieval/types';
import type { DomainPack } from './pack';
import { buildPrompt } from './prompt';
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
  // const input = definition({
  //     guardrails: [guardrail('g1')],
  //     validators: [validator('v1')],
  //     knowledge: { items: [{ id: 'k1', text: 'texto' }], toQuery: (i) => i.q },
  //   });

  const tracer = deps.tracer ?? createNoopTracer();
  const maxAttempts = deps.maxAttempts ?? 3;

  // Os eventos carregam só contagens, ids e status: nunca prompt, resposta ou mensagens de erro (regra 12).
  async function execute<TIn, TOut>(pack: DomainPack<TIn, TOut>, input: TIn): Promise<RunResult<TOut>> {
    const preResult = await runGuardrails(pack.guardrails, 'pre', { input });
    tracer.event('guardrail.pre', {
      action: preResult.action,
      ...(preResult.action === 'block' ? { guardrailId: preResult.guardrailId } : {}),
    });

    if (preResult.action === 'block') {
      return { status: 'blocked', reason: preResult.reason, guardrailId: preResult.guardrailId };
    }

    // RETRIEVE (regra 10): sem knowledge, embeddings ou store, segue com exemplos vazios.
    const examples =
      pack.knowledge && deps.embeddings && deps.store
        ? await retrieveExamples(pack, input, {
            embeddings: deps.embeddings,
            store: deps.store,
            topK: deps.topK ?? 3,
          })
        : [];
    tracer.event('retrieve.done', { count: examples.length });

    // Laço generate → validate (regra 6). ProviderError não é capturado: sobe sem consumir tentativa (regra 11).
    let previousErrors: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { system, prompt } = buildPrompt({ pack, input, examples, previousErrors });
      const startedAt = Date.now();
      const generated = await deps.provider.generate({ system, prompt, schema: pack.outputSchema });
      tracer.event('generate.attempt', {
        attempt,
        inputTokens: generated.usage.inputTokens,
        outputTokens: generated.usage.outputTokens,
        latencyMs: Date.now() - startedAt,
      });

      const parsed = parseStructuredOutput(generated.text, pack.outputSchema);
      if (!parsed.ok) {
        previousErrors = parsed.errors;
        tracer.event('validate.failed', { attempt, stage: 'schema', errorCount: parsed.errors.length });
        continue;
      }

      const validatorErrors = runValidators(parsed.data, pack.validators ?? []);
      if (validatorErrors.length > 0) {
        previousErrors = validatorErrors;
        tracer.event('validate.failed', { attempt, stage: 'validators', errorCount: validatorErrors.length });
        continue;
      }

      const postResult = await runGuardrails(pack.guardrails, 'post', { input, output: parsed.data });
      tracer.event('guardrail.post', {
        action: postResult.action,
        ...(postResult.action !== 'allow' ? { guardrailId: postResult.guardrailId } : {}),
      });

      if (postResult.action === 'block') {
        return { status: 'blocked', reason: postResult.reason, guardrailId: postResult.guardrailId };
      }

      if (postResult.action === 'modify') {
        // REVALIDAR (regra 8): o output do modify já é objeto (não texto JSON): vai direto ao schema.
        const revalidated = pack.outputSchema.safeParse(postResult.output);
        if (!revalidated.success) {
          return { status: 'invalid', errors: formatSchemaErrors(revalidated.error), attempts: attempt };
        }
        const revalidatorErrors = runValidators(revalidated.data, pack.validators ?? []);
        if (revalidatorErrors.length > 0) {
          return { status: 'invalid', errors: revalidatorErrors, attempts: attempt };
        }
        return { status: 'ok', data: revalidated.data, usage: generated.usage };
      }

      return { status: 'ok', data: parsed.data, usage: generated.usage };
    }

    return { status: 'invalid', errors: previousErrors, attempts: maxAttempts };
  }

  return {
    async run(pack, input) {
      tracer.event('pipeline.start', { packId: pack.id, packVersion: pack.version });
      const result = await execute(pack, input);
      tracer.event('pipeline.end', { status: result.status });
      return result;
    },
  };
}
