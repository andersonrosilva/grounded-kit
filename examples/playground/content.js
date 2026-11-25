/* global window */
/**
 * Conteúdo do playground: passo a passo de consumo (trechos TypeScript copiáveis) e referência da API pública.
 * Tudo é baseado nas assinaturas reais de `src/` (arquivo:linha em cada item da referência).
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ trechos TypeScript (partes reutilizáveis)
  const PARTS = {
    types: {
      imports: ["import { z } from 'zod';"],
      body: `// Contrato de entrada e saída do SEU domínio. O core não conhece nada disso (CR-01).
export interface NutritionInput {
  request: string;
  /** Alérgenos que o usuário declarou evitar. */
  allergens: readonly string[];
}

// O schema Zod é a fonte de verdade da saída (ADR-003): nada sai do pipeline sem passar por ele (CR-03).
export const nutritionOutputSchema = z.object({
  title: z.string().min(1),
  ingredients: z.array(z.object({ name: z.string(), grams: z.number().positive() })).min(1),
  calories: z.number().nonnegative(),
  steps: z.array(z.string()).min(1),
});
export type NutritionOutput = z.infer<typeof nutritionOutputSchema>;`,
    },
    policy: {
      imports: ["import type { Guardrail, Validator } from 'ai-kit/core';"],
      local: ["import type { NutritionInput, NutritionOutput } from './schema';"],
      body: `// Tabela sintética (kcal por 100 g) — é dado do pack, não do core.
const KCAL_PER_100G: Record<string, number> = { ovo: 143, tomate: 18, cebola: 40, azeite: 884, amendoim: 567 };
const ALLERGENS_OF: Record<string, string[]> = { ovo: ['ovo'], amendoim: ['amendoim'] };

// Validator = fato verificável por dado (ADR-002): calorias declaradas ≈ soma pela tabela.
export const caloriesMatchTable: Validator<NutritionOutput> = {
  id: 'calories-match-table',
  validate(out) {
    const expected = out.ingredients.reduce(
      (sum, i) => sum + ((KCAL_PER_100G[i.name] ?? 0) * i.grams) / 100,
      0,
    );
    const diff = Math.abs(out.calories - expected) / Math.max(expected, 1);
    return diff <= 0.15
      ? { ok: true }
      : { ok: false, error: \`calorias declaradas (\${out.calories}) divergem da tabela (≈\${Math.round(expected)})\` };
  },
};

// Guardrail = política (ADR-002, CR-02). 'pre' roda antes de chamar o modelo; 'post' depois de validar a saída.
export const allergenInRequest: Guardrail<NutritionInput, NutritionOutput> = {
  id: 'allergen-in-request',
  stage: 'pre',
  async check({ input }) {
    const hit = input.allergens.find((a) => input.request.toLowerCase().includes(a.toLowerCase()));
    return hit ? { action: 'block', reason: \`o pedido menciona "\${hit}"\` } : { action: 'allow' };
  },
};

export const allergenInRecipe: Guardrail<NutritionInput, NutritionOutput> = {
  id: 'allergen-in-recipe',
  stage: 'post',
  async check({ input, output }) {
    const bad = output?.ingredients.find((i) =>
      (ALLERGENS_OF[i.name] ?? []).some((a) => input.allergens.includes(a)),
    );
    return bad ? { action: 'block', reason: \`a receita contém "\${bad.name}"\` } : { action: 'allow' };
  },
};`,
    },
    pack: {
      imports: [
        "import { definePack } from 'ai-kit/core';",
        "import type { KnowledgeItem } from 'ai-kit/retrieval';",
      ],
      local: [
        "import { nutritionOutputSchema, type NutritionInput, type NutritionOutput } from './schema';",
        "import { allergenInRecipe, allergenInRequest, caloriesMatchTable } from './policy';",
      ],
      body: `// Base curada do domínio: cada item vira um vetor (embedding) e depois um "exemplo" no prompt.
const RECIPES: KnowledgeItem[] = [
  { id: 'r1', text: 'Omelete de legumes: ovo, tomate e cebola refogados no azeite.', metadata: { kcal: 290 } },
  { id: 'r2', text: 'Arroz com feijão e frango grelhado.', metadata: { kcal: 520 } },
];

// definePack valida a FORMA do pack na carga e devolve um objeto congelado.
// Pack malformado => PackDefinitionError com a lista de TODOS os problemas (ADR-005).
export const nutritionPack = definePack<NutritionInput, NutritionOutput>({
  id: 'nutrition',
  version: '0.1.0',
  prompts: {
    system: 'Você é um assistente de receitas. Responda somente com JSON.',
    // O pipeline anexa os exemplos recuperados (RAG) ao prompt como DADO, não instrução (regra 9).
    user: (input) =>
      \`Crie uma receita para: "\${input.request}". Evite: \${input.allergens.join(', ') || 'nenhuma restrição'}.\`,
  },
  outputSchema: nutritionOutputSchema,
  validators: [caloriesMatchTable],
  guardrails: [allergenInRequest, allergenInRecipe],
  knowledge: { items: RECIPES, toQuery: (input) => input.request },
});`,
    },
    providers: {
      imports: [
        "import { createGeminiProvider } from 'ai-kit/providers/gemini';",
        "import { createOllamaEmbeddings, createOllamaProvider } from 'ai-kit/providers/ollama';",
      ],
      body: `// Segredos e endereços vêm do ambiente (CR-04, ADR-009) — nunca do código.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(\`Variável de ambiente ausente: \${name}\`);
  return value;
}

// Provider de geração: Gemini (se houver chave) ou Ollama local (padrão, custo zero — ADR-008).
// O nome do modelo é configuração obrigatória: não existe padrão embutido.
export const provider = process.env.GEMINI_API_KEY
  ? createGeminiProvider({ apiKey: requireEnv('GEMINI_API_KEY'), model: requireEnv('GEMINI_MODEL') })
  : createOllamaProvider({ host: requireEnv('OLLAMA_HOST'), model: requireEnv('OLLAMA_MODEL') });

// Embeddings (adaptador Ollama): \`dimensions\` deve bater com o modelo escolhido; o índice depende dela.
export const embeddings = createOllamaEmbeddings({
  host: requireEnv('OLLAMA_HOST'),
  model: requireEnv('OLLAMA_EMBED_MODEL'),
  dimensions: 768,
});`,
    },
    index: {
      imports: ["import { createMemoryStore, indexKnowledge } from 'ai-kit/retrieval';"],
      local: [
        "import { nutritionPack } from './pack';",
        "import { embeddings } from './providers';",
      ],
      body: `// FASE 1 · Ingestão: roda uma vez (ou quando a base do pack mudar).
// O índice guarda com qual modelo de embeddings foi criado; trocar o modelo exige reindexar (regras 16–17).
export const store = createMemoryStore({ embeddingsId: embeddings.id, dimensions: embeddings.dimensions });

const { indexed } = await indexKnowledge(nutritionPack, { embeddings, store });
console.log(\`\${indexed} itens indexados\`);`,
    },
    pgvector: {
      imports: [
        "import pg from 'pg';",
        "import { createPgVectorStore } from 'ai-kit/retrieval/pgvector';",
      ],
      local: ["import { embeddings } from './providers';"],
      body: `// Alternativa persistente: Postgres + extensão pgvector. \`pg\` é peer opcional (pnpm add pg) — ADR-004.
const client = new pg.Client({ connectionString: process.env.PGVECTOR_URL }); // nunca logue esta URL (regra 18)
await client.connect();

export const store = createPgVectorStore({
  client,
  embeddingsId: embeddings.id,
  dimensions: embeddings.dimensions,
  table: 'nutrition_knowledge',
});
await store.ensureSchema(); // cria extensão/tabela e valida a compatibilidade do índice`,
    },
    tracer: {
      imports: ["import { createConsoleTracer } from 'ai-kit/ops';"],
      body: `// Uma linha JSON por evento (pipeline.start, guardrail.pre, retrieve.done, generate.attempt, ...).
// Por padrão NÃO registra conteúdo de prompts/respostas (CR-04). Sem tracer, o pipeline usa um no-op.
export const tracer = createConsoleTracer({ log: (line) => process.stdout.write(\`\${line}\\n\`) });`,
    },
    run: {
      imports: ["import { createPipeline, ProviderError } from 'ai-kit/core';"],
      local: [
        "import { store } from './indexing';",
        "import { nutritionPack } from './pack';",
        "import { embeddings, provider } from './providers';",
        "import { tracer } from './tracer';",
      ],
      body: `// FASE 2 · Consulta. Sem \`embeddings\` + \`store\`, o retrieve é pulado e os exemplos ficam vazios (regra 10).
const pipeline = createPipeline({ provider, embeddings, store, tracer, maxAttempts: 3, topK: 3 });

try {
  const result = await pipeline.run(nutritionPack, {
    request: 'Quero uma omelete com legumes',
    allergens: ['amendoim'],
  });

  // RunResult é uma união discriminada por \`status\` (ADR-006): trate os três casos.
  switch (result.status) {
    case 'ok':
      console.log(result.data.title, result.data.calories, result.usage);
      break;
    case 'blocked': // um guardrail vetou; nunca há conteúdo parcial
      console.warn(\`bloqueado por \${result.guardrailId}: \${result.reason}\`);
      break;
    case 'invalid': // esgotou as tentativas; \`errors\` são as falhas da última
      console.error(\`inválido após \${result.attempts} tentativa(s):\`, result.errors);
      break;
  }
} catch (err) {
  // Falha de infraestrutura (rede, autenticação, timeout) NÃO vira \`invalid\`: propaga e não consome tentativa.
  if (err instanceof ProviderError) console.error(\`provider \${err.providerId} falhou: \${err.message}\`);
  else throw err;
}`,
    },
  };

  /** Monta um trecho: imports (únicos) no topo + corpo. `withLocal` inclui os imports relativos entre arquivos. */
  function assemble(keys, withLocal) {
    const imports = [];
    for (const k of keys) {
      const lines = PARTS[k].imports.concat(withLocal ? PARTS[k].local || [] : []);
      for (const line of lines) if (!imports.includes(line)) imports.push(line);
    }
    return imports.join('\n') + '\n\n' + keys.map((k) => PARTS[k].body).join('\n\n');
  }

  const FULL_ORDER = ['types', 'policy', 'pack', 'providers', 'index', 'tracer', 'run'];

  const INSTALL_SNIPPET = `# 1) No repositório do kit: instalar dependências e gerar dist/ (ESM + CJS + .d.ts, uma entrada por subpath)
pnpm install
pnpm build

# 2) No seu projeto consumidor. O kit é "private" (0.0.0): o consumo é por caminho local, não pelo npm.
pnpm add link:../grounded-kit
pnpm add zod

# 3) Variáveis de ambiente: o .env.example traz só os NOMES. Copie, preencha e nunca commite valores (CR-04).
Copy-Item ..\\grounded-kit\\.env.example .env`;

  const STEPS = [
    {
      id: 'install',
      title: 'Instalar e gerar o build',
      summary:
        'O pacote se chama `ai-kit`, é `private` e só existe como código local. O `package.json` expõe 7 subpaths via `exports`; todos apontam para `dist/`, então rode `pnpm build` antes de consumir.',
      files: [{ name: 'PowerShell', lang: 'powershell', code: INSTALL_SNIPPET }],
      table: {
        head: ['Import', 'O que traz'],
        rows: [
          [
            'ai-kit/core',
            'definePack, createPipeline, buildPrompt, erros e os tipos/ports (Provider, Guardrail, Validator, Tracer, RunResult)',
          ],
          [
            'ai-kit/retrieval',
            'Ports Embeddings/VectorStore, createMemoryStore, indexKnowledge, retrieveExamples',
          ],
          [
            'ai-kit/retrieval/pgvector',
            'createPgVectorStore (Postgres + pgvector; `pg` é peer opcional)',
          ],
          ['ai-kit/quality', 'parseStructuredOutput, runValidators, runGuardrails'],
          ['ai-kit/ops', 'createNoopTracer, createConsoleTracer'],
          [
            'ai-kit/providers/ollama',
            'createOllamaProvider, createOllamaEmbeddings (padrão local)',
          ],
          ['ai-kit/providers/gemini', 'createGeminiProvider'],
        ],
      },
    },
    {
      id: 'schema',
      title: 'Declarar entrada e saída (Zod)',
      summary:
        'O core é agnóstico de domínio: quem define “o que entra” e “o que sai” é o seu pack. O schema Zod é a fonte de verdade — nenhuma resposta do modelo é devolvida sem passar por ele.',
      files: [{ name: 'nutrition/schema.ts', lang: 'ts', code: assemble(['types'], true) }],
    },
    {
      id: 'policy',
      title: 'Validators e guardrails (a política)',
      summary:
        'Validator checa um **fato verificável por dado**; Guardrail aplica **política** (`pre` antes do modelo, `post` depois). A política mora no pack — nunca no core (CR-02).',
      files: [{ name: 'nutrition/policy.ts', lang: 'ts', code: assemble(['policy'], true) }],
      notes: [
        '`block` interrompe o pipeline e devolve `blocked`; `modify` troca a saída (que é revalidada); `allow` segue.',
        'No pipeline real, `pre` que bloqueia nem chega a chamar o provider (regra 7).',
      ],
    },
    {
      id: 'pack',
      title: 'Montar o domain pack com definePack',
      summary:
        '`definePack` junta prompts, schema, validators, guardrails e a base de conhecimento num objeto **declarativo, tipado e congelado**. É o único ponto de contato entre o seu domínio e o motor.',
      files: [{ name: 'nutrition/pack.ts', lang: 'ts', code: assemble(['pack'], true) }],
    },
    {
      id: 'providers',
      title: 'Escolher provider e embeddings',
      summary:
        'Os adaptadores usam `fetch` (injetável nos testes). Chaves, host e modelo vêm de variáveis de ambiente — os nomes estão no `.env.example`.',
      files: [{ name: 'nutrition/providers.ts', lang: 'ts', code: assemble(['providers'], true) }],
      table: {
        head: ['Variável', 'Usada por', 'Obrigatória?'],
        rows: [
          [
            'OLLAMA_HOST',
            'createOllamaProvider / createOllamaEmbeddings (`host`)',
            'sim, ao usar Ollama',
          ],
          ['OLLAMA_MODEL', 'createOllamaProvider (`model`)', 'sim — sem padrão embutido'],
          ['OLLAMA_EMBED_MODEL', 'createOllamaEmbeddings (`model`)', 'sim, para RAG com Ollama'],
          ['GEMINI_API_KEY', 'createGeminiProvider (`apiKey`)', 'sim, ao usar Gemini'],
          ['GEMINI_MODEL', 'createGeminiProvider (`model`)', 'sim, ao usar Gemini'],
          [
            'PGVECTOR_URL',
            'connection string do cliente `pg` (adaptador pgvector)',
            'só com pgvector',
          ],
        ],
      },
    },
    {
      id: 'index',
      title: 'Indexar a base (ingestão do RAG)',
      summary:
        'Duas fases separadas: **ingestão** (`indexKnowledge`: itens → embeddings → `store.upsert`) e **consulta** (feita pelo pipeline em cada `run`). Reindexar o mesmo pack não duplica itens (upsert por `id`).',
      files: [
        { name: 'nutrition/indexing.ts (memória)', lang: 'ts', code: assemble(['index'], true) },
        {
          name: 'nutrition/indexing.ts (pgvector)',
          lang: 'ts',
          code: assemble(['pgvector'], true),
        },
      ],
    },
    {
      id: 'tracer',
      title: 'Observabilidade (opcional)',
      summary:
        'Interface mínima `Tracer` (ADR-007). Sem conteúdo de prompt/resposta por padrão (CR-04).',
      files: [{ name: 'nutrition/tracer.ts', lang: 'ts', code: assemble(['tracer'], true) }],
    },
    {
      id: 'run',
      title: 'Criar o pipeline e executar',
      summary:
        '`run` faz `pre → retrieve → (generate → validate)×N → post` e devolve `ok | blocked | invalid`. Só falhas de infraestrutura viram exceção (`ProviderError`).',
      files: [{ name: 'nutrition/run.ts', lang: 'ts', code: assemble(['run'], true) }],
    },
    {
      id: 'full',
      title: 'Script completo',
      summary: 'Todas as peças juntas em um único arquivo (memória como store). Copie e ajuste.',
      files: [{ name: 'main.ts', lang: 'ts', code: assemble(FULL_ORDER) }],
    },
  ];

  // ------------------------------------------------------------------ referência da API
  const P = (name, type, desc, optional) => ({ name, type, desc, optional: !!optional });

  const API = [
    {
      subpath: 'ai-kit/core',
      items: [
        {
          name: 'definePack',
          kind: 'function',
          source: 'src/core/pack.ts:38',
          signature:
            'function definePack<TIn, TOut>(definition: PackDefinition<TIn, TOut>): DomainPack<TIn, TOut>',
          summary: 'Valida a forma do pack na carga e o devolve congelado (`Object.freeze`).',
          params: [
            P(
              'definition',
              'PackDefinition<TIn, TOut>',
              'id, version, prompts, outputSchema e, opcionalmente, guardrails, validators e knowledge.',
            ),
          ],
          returns: 'DomainPack<TIn, TOut> — `Readonly<PackDefinition>`.',
          throws:
            'PackDefinitionError listando TODOS os problemas (id/version vazios, outputSchema ausente, ids duplicados, knowledge sem toQuery).',
          rules: 'ADR-005 · regras 1, 2, 5',
        },
        {
          name: 'createPipeline',
          kind: 'function',
          source: 'src/core/pipeline.ts:30',
          signature: 'function createPipeline(deps: PipelineDeps): Pipeline',
          summary: 'Cria o orquestrador `retrieve → generate → validate → moderate`.',
          params: [
            P(
              'deps',
              'PipelineDeps',
              'provider (obrigatório); embeddings + store (RAG); tracer; maxAttempts (padrão 3); topK (padrão 3).',
            ),
          ],
          returns: 'Pipeline — `run(pack, input): Promise<RunResult<TOut>>`.',
          throws: 'ProviderError (propaga; não consome tentativa).',
          rules: 'ADR-006 · regras 4–8, 10–12 · CR-03',
        },
        {
          name: 'PipelineDeps',
          kind: 'interface',
          source: 'src/core/pipeline.ts:13',
          signature: `interface PipelineDeps {
  provider: Provider;
  embeddings?: Embeddings;
  store?: VectorStore;
  tracer?: Tracer;      // padrão: no-op
  maxAttempts?: number; // padrão 3
  topK?: number;        // padrão 3
}`,
          summary:
            'Dependências injetadas no pipeline. Sem `embeddings` + `store`, o retrieve é pulado.',
        },
        {
          name: 'Pipeline',
          kind: 'interface',
          source: 'src/core/pipeline.ts:26',
          signature: `interface Pipeline {
  run<TIn, TOut>(pack: DomainPack<TIn, TOut>, input: TIn): Promise<RunResult<TOut>>;
}`,
          summary: 'Executa o pack sobre uma entrada. É a única operação do pipeline.',
        },
        {
          name: 'RunResult',
          kind: 'type',
          source: 'src/core/types.ts:80',
          signature: `type RunResult<TOut> =
  | { status: 'ok'; data: TOut; usage: Usage }
  | { status: 'blocked'; reason: string; guardrailId: string }
  | { status: 'invalid'; errors: string[]; attempts: number };`,
          summary:
            'União discriminada por `status`: sucesso validado, veto de guardrail ou esgotamento de tentativas.',
        },
        {
          name: 'PackDefinition',
          kind: 'interface',
          source: 'src/core/pack.ts:26',
          signature: `interface PackDefinition<TIn, TOut> {
  id: string;
  version: string;
  prompts: PackPrompts<TIn>;
  outputSchema: OutputSchema<TOut>;
  guardrails?: readonly Guardrail<TIn, TOut>[];
  validators?: readonly Validator<TOut>[];
  knowledge?: PackKnowledge<TIn>;
}
type DomainPack<TIn, TOut> = Readonly<PackDefinition<TIn, TOut>>;`,
          summary:
            'Contrato declarativo do domain pack (ADR-005). `DomainPack` é o resultado de `definePack`.',
        },
        {
          name: 'PackPrompts / PackKnowledge',
          kind: 'interface',
          source: 'src/core/pack.ts:13',
          signature: `interface PackPrompts<TIn> {
  system?: string;
  user(input: TIn, examples: readonly KnowledgeItem[]): string;
}
interface PackKnowledge<TIn> {
  items: readonly KnowledgeItem[];
  toQuery(input: TIn): string;
}`,
          summary:
            '`user` monta o prompt do usuário; `toQuery` transforma a entrada no texto usado para buscar itens similares.',
        },
        {
          name: 'buildPrompt',
          kind: 'function',
          source: 'src/core/prompt.ts:28',
          signature:
            'function buildPrompt<TIn, TOut>(args: BuildPromptArgs<TIn, TOut>): BuiltPrompt',
          summary:
            'Monta o prompt final: `pack.prompts.user(...)` + exemplos recuperados + feedback de retry.',
          params: [P('args', 'BuildPromptArgs', '{ pack, input, examples, previousErrors? }')],
          returns: '{ system?: string; prompt: string }',
          rules: 'ADR-006 · regra 9 (conteúdo recuperado é dado)',
        },
        {
          name: 'renderExamples',
          kind: 'function',
          source: 'src/core/prompt.ts:32',
          signature: 'function renderExamples(examples: readonly KnowledgeItem[]): string',
          summary:
            'Envolve cada exemplo em bloco delimitado e rotulado “dado, não instrução”. Lista vazia ⇒ string vazia.',
          returns: 'string',
        },
        {
          name: 'renderRetryFeedback',
          kind: 'function',
          source: 'src/core/prompt.ts:36',
          signature: 'function renderRetryFeedback(errors: readonly string[]): string',
          summary: 'Transforma os erros da tentativa anterior em texto para o modelo corrigir.',
          returns: 'string',
        },
        {
          name: 'ProviderError',
          kind: 'class',
          source: 'src/core/errors.ts:10',
          signature: `class ProviderError extends Error {
  readonly providerId: string;
  readonly cause?: unknown;
  constructor(message: string, providerId: string, cause?: unknown);
}`,
          summary:
            'Falha de rede, autenticação ou timeout com um provider. Propaga como exceção; não vira `invalid` e não consome tentativa.',
          rules: 'regra 11',
        },
        {
          name: 'PackDefinitionError',
          kind: 'class',
          source: 'src/core/errors.ts:21',
          signature: `class PackDefinitionError extends Error {
  readonly issues: readonly string[];
  constructor(message: string, issues: readonly string[]);
}`,
          summary: 'Pack malformado, detectado por `definePack` na carga (falha explícita).',
          rules: 'ADR-005 · regra 5',
        },
        {
          name: 'Provider · GenerateRequest · GenerateResult · Usage',
          kind: 'interface',
          source: 'src/core/types.ts:11',
          signature: `interface Provider {
  readonly id: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}
interface GenerateRequest {
  system?: string;
  prompt: string;
  schema?: ZodType;      // o adaptador converte para o formato nativo quando suporta
  temperature?: number;
  signal?: AbortSignal;
}
interface GenerateResult {
  text: string;          // texto bruto; o pipeline faz o parse (nunca por regex)
  data?: unknown;        // quando o adaptador já devolve objeto
  usage: Usage;
}
interface Usage { inputTokens: number; outputTokens: number; costUsd?: number }`,
          summary: 'Port de geração. Implemente-o para plugar qualquer LLM (ADR-008).',
        },
        {
          name: 'Guardrail · GuardrailContext · GuardrailVerdict',
          kind: 'interface',
          source: 'src/core/types.ts:43',
          signature: `type GuardrailStage = 'pre' | 'post';
type GuardrailVerdict =
  | { action: 'allow' }
  | { action: 'block'; reason: string }
  | { action: 'modify'; output: unknown; reason?: string };

interface GuardrailContext<TIn = unknown, TOut = unknown> {
  input: TIn;
  output?: TOut;   // só existe no estágio 'post'
}
interface Guardrail<TIn = unknown, TOut = unknown> {
  readonly id: string;
  readonly stage: GuardrailStage;
  check(ctx: GuardrailContext<TIn, TOut>): Promise<GuardrailVerdict>;
}`,
          summary:
            'Ponto de encaixe da política (ADR-002). O kit não traz regra nenhuma: ela vive no pack.',
        },
        {
          name: 'Validator · ValidationResult',
          kind: 'interface',
          source: 'src/core/types.ts:64',
          signature: `type ValidationResult = { ok: true } | { ok: false; error: string };
interface Validator<TOut = unknown> {
  readonly id: string;
  validate(output: TOut): ValidationResult;
}`,
          summary:
            'Verifica um fato por dado. A mensagem de `error` vira feedback de retry para o modelo.',
        },
        {
          name: 'Tracer',
          kind: 'interface',
          source: 'src/core/types.ts:73',
          signature: `interface Tracer {
  event(name: string, data: Record<string, unknown>): void;
}`,
          summary:
            'Interface mínima de tracing (ADR-007). Não deve receber conteúdo de prompts/respostas.',
        },
        {
          name: 'OutputSchema',
          kind: 'type',
          source: 'src/core/types.ts:86',
          signature: 'type OutputSchema<TOut> = ZodType<TOut>;',
          summary: 'Schema Zod de saída de um pack (ADR-003).',
        },
      ],
    },
    {
      subpath: 'ai-kit/retrieval',
      items: [
        {
          name: 'indexKnowledge',
          kind: 'function',
          source: 'src/retrieval/knowledge.ts:29',
          signature: `function indexKnowledge<TIn, TOut>(
  pack: DomainPack<TIn, TOut>,
  deps: KnowledgeDeps,   // { embeddings: Embeddings; store: VectorStore }
): Promise<{ indexed: number }>`,
          summary:
            'Fase de ingestão: itens do pack → embeddings (em lotes) → `store.upsert`. Pack sem `knowledge` ⇒ `{ indexed: 0 }`.',
          params: [
            P('pack', 'DomainPack', 'Pack cuja base será indexada.'),
            P('deps', 'KnowledgeDeps', 'Embeddings + VectorStore.'),
          ],
          returns: 'Promise<{ indexed: number }>',
          rules: 'regras 16, 17',
        },
        {
          name: 'retrieveExamples',
          kind: 'function',
          source: 'src/retrieval/knowledge.ts:36',
          signature: `function retrieveExamples<TIn, TOut>(
  pack: DomainPack<TIn, TOut>,
  input: TIn,
  deps: KnowledgeDeps & { topK?: number },
): Promise<KnowledgeItem[]>`,
          summary:
            'Fase de consulta: `toQuery(input)` → embed → `store.query(topK)`. Devolve só os `payload`, em ordem de similaridade. Sem knowledge ou índice vazio ⇒ `[]` (não é erro).',
          returns: 'Promise<KnowledgeItem[]>',
          rules: 'regras 9, 10',
        },
        {
          name: 'assertCompatibleIndex',
          kind: 'function',
          source: 'src/retrieval/knowledge.ts:25',
          signature:
            'function assertCompatibleIndex(store: VectorStore, embeddings: Embeddings): void',
          summary:
            'Compara `store.info` com `embeddings.id`/`dimensions`. Divergência ⇒ erro explícito pedindo reindexação.',
          throws: 'Error (modelo ou dimensão diferentes).',
          rules: 'regra 17',
        },
        {
          name: 'createMemoryStore',
          kind: 'function',
          source: 'src/retrieval/memory-store.ts:17',
          signature: 'function createMemoryStore(info: IndexInfo): VectorStore',
          summary:
            'VectorStore em memória (referência e testes, sem banco). `upsert` substitui por `id`; `query` ordena por score decrescente e corta em `topK`.',
          params: [
            P('info', 'IndexInfo', '{ embeddingsId, dimensions } do modelo de embeddings usado.'),
          ],
          returns: 'VectorStore',
        },
        {
          name: 'cosineSimilarity',
          kind: 'function',
          source: 'src/retrieval/memory-store.ts:13',
          signature:
            'function cosineSimilarity(a: readonly number[], b: readonly number[]): number',
          summary:
            'Produto escalar ÷ (norma a × norma b). Tamanhos diferentes ou norma zero: o contrato deixa a decisão (falhar ou 0) para o teste.',
          returns: 'number (maior = mais similar)',
        },
        {
          name: 'Embeddings · VectorStore',
          kind: 'interface',
          source: 'src/retrieval/types.ts:19',
          signature: `interface Embeddings {
  readonly id: string;          // modelo + versão
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
interface VectorStore {
  readonly info: IndexInfo;
  upsert(items: VectorItem[]): Promise<void>;
  query(vector: number[], opts: { topK: number }): Promise<VectorHit[]>;
}`,
          summary:
            'Ports do RAG. Implemente-os para plugar outro modelo de embeddings ou outro banco vetorial.',
        },
        {
          name: 'KnowledgeItem · VectorItem · VectorHit · IndexInfo',
          kind: 'interface',
          source: 'src/retrieval/types.ts:13',
          signature: `interface KnowledgeItem { id: string; text: string; metadata?: Record<string, unknown> }
interface VectorItem   { id: string; vector: number[]; payload: KnowledgeItem }
interface VectorHit    { id: string; score: number; payload: KnowledgeItem }  // maior = mais similar
interface IndexInfo    { embeddingsId: string; dimensions: number }`,
          summary:
            'Fluxo: `KnowledgeItem` —embed→ `VectorItem` —upsert→ índice; consulta —query→ `VectorHit[]` → exemplos no prompt.',
        },
      ],
    },
    {
      subpath: 'ai-kit/retrieval/pgvector',
      items: [
        {
          name: 'createPgVectorStore',
          kind: 'function',
          source: 'src/retrieval/pgvector/index.ts:34',
          signature: 'function createPgVectorStore(options: PgVectorStoreOptions): PgVectorStore',
          summary:
            'VectorStore sobre Postgres + pgvector. O `client` é um tipo mínimo compatível com `pg`; a connection string nunca é logada nem enviada ao tracer.',
          params: [
            P(
              'options',
              'PgVectorStoreOptions',
              'client, embeddingsId, dimensions e table? (identificador validado antes de entrar no SQL).',
            ),
          ],
          returns: 'PgVectorStore — VectorStore + `ensureSchema(): Promise<void>`.',
          rules: 'regras 16–18 · CR-04',
        },
        {
          name: 'PgClientLike · PgVectorStoreOptions · PgVectorStore',
          kind: 'interface',
          source: 'src/retrieval/pgvector/index.ts:19',
          signature: `interface PgClientLike {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}
interface PgVectorStoreOptions extends IndexInfo {
  client: PgClientLike;
  table?: string;
}
interface PgVectorStore extends VectorStore {
  ensureSchema(): Promise<void>;
}`,
          summary:
            '`ensureSchema` cria extensão/tabela/metadados e valida se o índice existente usa o mesmo modelo de embeddings.',
        },
      ],
    },
    {
      subpath: 'ai-kit/quality',
      items: [
        {
          name: 'parseStructuredOutput',
          kind: 'function',
          source: 'src/quality/structured-output.ts:17',
          signature: `function parseStructuredOutput<T>(text: string, schema: ZodType<T>): ParseOutcome<T>
type ParseOutcome<T> = { ok: true; data: T } | { ok: false; errors: string[] }`,
          summary:
            '`JSON.parse` em try/catch + `schema.safeParse`. **Sem regex de extração de JSON** (CR-03): texto com lixo ao redor é rejeitado.',
          params: [
            P('text', 'string', 'Texto bruto do modelo.'),
            P('schema', 'ZodType<T>', 'Schema de saída do pack.'),
          ],
          returns: 'ParseOutcome<T>',
          rules: 'ADR-003 · CR-03',
        },
        {
          name: 'formatSchemaErrors',
          kind: 'function',
          source: 'src/quality/structured-output.ts:21',
          signature: 'function formatSchemaErrors(error: unknown): string[]',
          summary:
            'Erro do Zod → frases curtas citando o caminho do campo. Esse texto vira feedback de retry.',
          returns: 'string[]',
        },
        {
          name: 'runValidators',
          kind: 'function',
          source: 'src/quality/structured-output.ts:25',
          signature:
            'function runValidators<T>(data: T, validators: readonly Validator<T>[]): string[]',
          summary:
            'Roda todos os validators (não para no primeiro erro). Lista vazia = tudo certo.',
          returns: 'string[] — mensagens de falha.',
        },
        {
          name: 'runGuardrails',
          kind: 'function',
          source: 'src/quality/guardrails.ts:20',
          signature: `function runGuardrails<TIn, TOut>(
  guardrails: readonly Guardrail<TIn, TOut>[] | undefined,
  stage: GuardrailStage,
  ctx: GuardrailContext<TIn, TOut>,
): Promise<GuardrailRun>

type GuardrailRun =
  | { action: 'allow' }
  | { action: 'block'; reason: string; guardrailId: string }
  | { action: 'modify'; output: unknown; guardrailId: string }`,
          summary:
            'Roda, em ordem, só os guardrails do estágio pedido. O primeiro `block` interrompe; `modify` substitui a saída para os seguintes. O pipeline é quem revalida o `modify`.',
          returns: 'Promise<GuardrailRun>',
          rules: 'ADR-002 · regras 7, 8',
        },
      ],
    },
    {
      subpath: 'ai-kit/ops',
      items: [
        {
          name: 'createNoopTracer',
          kind: 'function',
          source: 'src/ops/tracer.ts:26',
          signature: 'function createNoopTracer(): Tracer',
          summary: 'Não faz nada. É o tracer padrão do pipeline.',
          returns: 'Tracer',
        },
        {
          name: 'createConsoleTracer',
          kind: 'function',
          source: 'src/ops/tracer.ts:30',
          signature: `function createConsoleTracer(options?: ConsoleTracerOptions): Tracer
interface ConsoleTracerOptions { log?: (line: string) => void }  // padrão: console.log`,
          summary:
            'Escreve uma linha JSON por evento. Descarta chaves que carregam conteúdo (`prompt`, `text`, `output`): é a última barreira.',
          returns: 'Tracer',
          rules: 'ADR-007 · regra 12 · CR-04',
        },
        {
          name: 'TraceEventName',
          kind: 'type',
          source: 'src/ops/tracer.ts:13',
          signature: `type TraceEventName =
  | 'pipeline.start' | 'guardrail.pre' | 'retrieve.done' | 'generate.attempt'
  | 'validate.failed' | 'guardrail.post' | 'pipeline.end';`,
          summary: 'Nomes de evento usados pelo pipeline (sugestão; manter em sincronia com ele).',
        },
      ],
    },
    {
      subpath: 'ai-kit/providers/ollama',
      items: [
        {
          name: 'createOllamaProvider',
          kind: 'function',
          source: 'src/providers/ollama/index.ts:31',
          signature: `function createOllamaProvider(options: OllamaProviderOptions): Provider
interface OllamaProviderOptions { host: string; model: string; fetch?: typeof fetch }`,
          summary:
            'Provider de geração sobre o servidor Ollama local. O **modelo é obrigatório** (sem padrão). Falha de rede/HTTP ⇒ `ProviderError`.',
          params: [
            P('host', 'string', 'Endereço do servidor (de OLLAMA_HOST).'),
            P('model', 'string', 'Modelo de geração (OLLAMA_MODEL).'),
            P('fetch', 'typeof fetch', 'Injetável para testes sem rede.', true),
          ],
          returns: 'Provider',
          rules: 'ADR-008 · regras 11, 16',
        },
        {
          name: 'createOllamaEmbeddings',
          kind: 'function',
          source: 'src/providers/ollama/index.ts:35',
          signature: `function createOllamaEmbeddings(options: OllamaEmbeddingsOptions): Embeddings
interface OllamaEmbeddingsOptions { host: string; model: string; dimensions: number; fetch?: typeof fetch }`,
          summary:
            'Embeddings via Ollama. `dimensions` é informado pelo chamador e conferido na primeira resposta.',
          params: [
            P('host', 'string', 'OLLAMA_HOST'),
            P('model', 'string', 'OLLAMA_EMBED_MODEL'),
            P('dimensions', 'number', 'Dimensão do vetor do modelo; o índice depende dela.'),
            P('fetch', 'typeof fetch', 'Injetável para testes.', true),
          ],
          returns: 'Embeddings',
        },
      ],
    },
    {
      subpath: 'ai-kit/providers/gemini',
      items: [
        {
          name: 'createGeminiProvider',
          kind: 'function',
          source: 'src/providers/gemini/index.ts:22',
          signature: `function createGeminiProvider(options: GeminiProviderOptions): Provider
interface GeminiProviderOptions { apiKey: string; model: string; fetch?: typeof fetch }`,
          summary:
            'Provider sobre a API do Gemini via `fetch`. Converte o schema Zod para o formato nativo quando possível (senão o pipeline valida). A chave nunca é logada nem aparece em erros.',
          params: [
            P('apiKey', 'string', 'De GEMINI_API_KEY.'),
            P('model', 'string', 'De GEMINI_MODEL.'),
            P('fetch', 'typeof fetch', 'Injetável para testes.', true),
          ],
          returns: 'Provider',
          rules: 'ADR-008, ADR-009 · regras 11, 13',
        },
      ],
    },
  ];

  const RULES = [
    {
      id: 'CR-01',
      title: 'O core não conhece domínio',
      text: 'Nomes, schemas, prompts e dados de um domínio vivem só no domain pack.',
    },
    {
      id: 'CR-02',
      title: 'A política fica no pack',
      text: 'O kit só oferece o ponto de encaixe (`Guardrail`); a regra e os testes dela são do pack.',
    },
    {
      id: 'CR-03',
      title: 'Saída sempre validada',
      text: 'Nada de LLM volta sem passar pelo schema; sem regex de extração; esgotou ⇒ `invalid`.',
    },
    {
      id: 'CR-04',
      title: 'Sem segredos nem dados sem licença',
      text: 'Chaves só em variáveis de ambiente; traces não registram prompts/respostas.',
    },
  ];

  window.PG_CONTENT = { STEPS, API, RULES, PARTS, FULL_ORDER, assemble };
})();
