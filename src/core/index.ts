/** [Passo 1] Exports públicos de `ai-kit/core`. */
export type {
  GenerateRequest,
  GenerateResult,
  Guardrail,
  GuardrailContext,
  GuardrailStage,
  GuardrailVerdict,
  OutputSchema,
  Provider,
  RunResult,
  Tracer,
  Usage,
  ValidationResult,
  Validator,
} from './types';
export { PackDefinitionError, ProviderError } from './errors';
export type { DomainPack, PackDefinition, PackKnowledge, PackPrompts } from './pack';
export { definePack } from './pack';
export type { BuildPromptArgs, BuiltPrompt } from './prompt';
export { buildPrompt, renderExamples, renderRetryFeedback } from './prompt';
export type { Pipeline, PipelineDeps } from './pipeline';
export { createPipeline } from './pipeline';
