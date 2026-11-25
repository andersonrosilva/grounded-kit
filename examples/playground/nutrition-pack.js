/* global window */
/**
 * Versão JS do pack `examples/nutrition-pack` (no repositório ele ainda é um esqueleto: data.ts/pack.ts lançam
 * `not implemented`). Dados SINTÉTICOS, inventados para estudo — não é aconselhamento nutricional (CR-04).
 */
(function () {
  'use strict';
  const { s, definePack } = window.KitSim;

  // kcal por 100 g (valores inventados) e alérgenos associados
  const FOODS = {
    ovo: { kcal: 143, allergens: ['ovo'] },
    leite: { kcal: 60, allergens: ['leite'] },
    queijo: { kcal: 350, allergens: ['leite'] },
    'farinha de trigo': { kcal: 364, allergens: ['glúten'] },
    aveia: { kcal: 389, allergens: ['glúten'] },
    amendoim: { kcal: 567, allergens: ['amendoim'] },
    arroz: { kcal: 130, allergens: [] },
    feijão: { kcal: 127, allergens: [] },
    frango: { kcal: 165, allergens: [] },
    tomate: { kcal: 18, allergens: [] },
    cebola: { kcal: 40, allergens: [] },
    azeite: { kcal: 884, allergens: [] },
    batata: { kcal: 77, allergens: [] },
    cenoura: { kcal: 41, allergens: [] },
    banana: { kcal: 89, allergens: [] },
  };

  const RECIPES = [
    {
      id: 'r1',
      text: 'Omelete de legumes: ovo, tomate e cebola refogados no azeite; dobrar e servir quente.',
      metadata: { kcal: 290 },
    },
    {
      id: 'r2',
      text: 'Arroz com feijão e frango grelhado: base simples de arroz, feijão cozido e peito de frango.',
      metadata: { kcal: 520 },
    },
    {
      id: 'r3',
      text: 'Panqueca de banana e aveia: banana amassada, aveia e ovo; dourar dos dois lados.',
      metadata: { kcal: 310 },
    },
    {
      id: 'r4',
      text: 'Sopa de cenoura e batata: cozinhar cenoura, batata e cebola com azeite e bater no liquidificador.',
      metadata: { kcal: 180 },
    },
    {
      id: 'r5',
      text: 'Pão de queijo assado: farinha de trigo, queijo, ovo e leite; assar até dourar.',
      metadata: { kcal: 380 },
    },
    {
      id: 'r6',
      text: 'Granola caseira de amendoim: aveia, amendoim e banana desidratada assados lentamente.',
      metadata: { kcal: 450 },
    },
  ];

  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const outputSchema = s.object({
    title: s.string({ min: 1 }),
    ingredients: s.array(s.object({ name: s.string(), grams: s.number({ positive: true }) }), {
      min: 1,
    }),
    calories: s.number({ nonnegative: true }),
    steps: s.array(s.string(), { min: 1 }),
  });

  /** Validator: calorias declaradas ≈ soma pela tabela (tolerância configurável). */
  function caloriesValidator(tolerance) {
    return {
      id: 'calories-match-table',
      validate(out) {
        const expected = out.ingredients.reduce(
          (sum, i) => sum + ((FOODS[i.name]?.kcal ?? 0) * i.grams) / 100,
          0,
        );
        const diff = Math.abs(out.calories - expected) / Math.max(expected, 1);
        return diff <= tolerance
          ? { ok: true }
          : {
              ok: false,
              error: `calorias declaradas (${out.calories}) divergem da tabela (≈${Math.round(expected)}) além de ${Math.round(tolerance * 100)}%`,
            };
      },
    };
  }

  const allergenInRequest = {
    id: 'allergen-in-request',
    stage: 'pre',
    async check({ input }) {
      const hit = input.allergens.find((a) => norm(input.request).includes(norm(a)));
      return hit
        ? { action: 'block', reason: `o pedido menciona "${hit}", alérgeno declarado pelo usuário` }
        : { action: 'allow' };
    },
  };

  const allergenInRecipe = {
    id: 'allergen-in-recipe',
    stage: 'post',
    async check({ input, output }) {
      const declared = input.allergens.map(norm);
      const bad = output.ingredients.find((i) =>
        (FOODS[i.name]?.allergens ?? []).some((a) => declared.includes(norm(a))),
      );
      return bad
        ? {
            action: 'block',
            reason: `a receita contém "${bad.name}", associado a alérgeno declarado`,
          }
        : { action: 'allow' };
    },
  };

  /** modify válido: acrescenta um passo de aviso (continua cumprindo o schema). */
  const addDisclaimer = {
    id: 'add-disclaimer',
    stage: 'post',
    async check({ output }) {
      return {
        action: 'modify',
        reason: 'aviso didático',
        output: {
          ...output,
          steps: [...output.steps, 'Aviso: material didático, não é aconselhamento nutricional.'],
        },
      };
    },
  };

  /** modify que QUEBRA o schema: remove o campo `steps` — a regra 8 exige revalidar. */
  const brokenModify = {
    id: 'broken-modify',
    stage: 'post',
    async check({ output }) {
      const rest = { ...output };
      delete rest.steps;
      return { action: 'modify', reason: 'remove os passos (de propósito)', output: rest };
    },
  };

  /** Monta o pack conforme as opções do playground. */
  function createNutritionPack(opts) {
    const guardrails = [];
    if (opts.preGuardrail) guardrails.push(allergenInRequest);
    if (opts.postGuardrail) guardrails.push(allergenInRecipe);
    if (opts.postModify === 'valid') guardrails.push(addDisclaimer);
    if (opts.postModify === 'broken') guardrails.push(brokenModify);
    return definePack({
      id: 'nutrition',
      version: '0.1.0',
      prompts: {
        system:
          'Você é um assistente de receitas. Responda SOMENTE com JSON: { title, ingredients:[{name,grams}], calories, steps }.',
        user: (input) =>
          `Crie uma receita para o pedido: "${input.request}". Evite: ${input.allergens.join(', ') || 'nenhuma restrição'}.`,
      },
      outputSchema,
      validators: opts.calorieValidator ? [caloriesValidator(opts.tolerance)] : [],
      guardrails,
      knowledge: { items: RECIPES, toQuery: (input) => input.request },
    });
  }

  // ---- respostas roteirizadas do modelo simulado (cenários) ----
  const json = (o) => JSON.stringify(o, null, 2);
  const OMELETE = {
    title: 'Omelete de legumes',
    ingredients: [
      { name: 'ovo', grams: 120 },
      { name: 'tomate', grams: 80 },
      { name: 'cebola', grams: 30 },
      { name: 'azeite', grams: 10 },
    ],
    calories: 290,
    steps: ['Bata os ovos.', 'Refogue tomate e cebola no azeite.', 'Junte os ovos e dobre.'],
  };
  const CHAT_TEXT = 'Claro! Aqui está a receita que você pediu:\n' + json(OMELETE);
  const WRONG_TYPE = json({ ...OMELETE, calories: '290 kcal' });
  const WRONG_KCAL = json({ ...OMELETE, calories: 900 });
  const WITH_PEANUT = json({
    title: 'Omelete crocante',
    ingredients: [
      { name: 'ovo', grams: 120 },
      { name: 'amendoim', grams: 20 },
      { name: 'tomate', grams: 80 },
    ],
    calories: 300,
    steps: ['Bata os ovos.', 'Junte o amendoim triturado.', 'Frite.'],
  });

  const SEP = '\n---\n';
  const DEFAULTS = {
    request: 'Quero uma omelete com legumes',
    allergens: ['amendoim'],
    script: json(OMELETE),
    maxAttempts: 3,
    topK: 3,
    rag: true,
    index: 'ok',
    preGuardrail: true,
    postGuardrail: true,
    postModify: 'none',
    calorieValidator: true,
    tolerance: 0.15,
    tracer: 'console',
  };

  const PRESETS = [
    { id: 'ok', label: 'Caminho feliz', desc: 'A 1ª resposta já é válida → status ok.', patch: {} },
    {
      id: 'retry-json',
      label: 'Retry: resposta não é JSON',
      desc: 'O modelo “conversa” antes do JSON. Não há regex de extração (CR-03): falha e tenta de novo, com os erros no prompt.',
      patch: { script: CHAT_TEXT + SEP + json(OMELETE) },
    },
    {
      id: 'retry-schema',
      label: 'Retry: viola o schema',
      desc: '`calories` vem como texto; o feedback cita o campo e o modelo corrige na 2ª tentativa.',
      patch: { script: WRONG_TYPE + SEP + json(OMELETE) },
    },
    {
      id: 'invalid',
      label: 'Esgota tentativas → invalid',
      desc: 'Calorias sempre divergem da tabela: após maxAttempts o resultado é invalid (nunca dado não validado).',
      patch: { script: [WRONG_KCAL, WRONG_KCAL, WRONG_KCAL].join(SEP) },
    },
    {
      id: 'pre-block',
      label: 'Guardrail pre bloqueia',
      desc: 'O pedido cita um alérgeno declarado → blocked SEM chamar o provider (regra 7).',
      patch: { request: 'Panqueca com pasta de amendoim' },
    },
    {
      id: 'post-block',
      label: 'Guardrail post bloqueia',
      desc: 'A resposta é válida, mas contém amendoim → blocked, sem conteúdo parcial.',
      patch: { script: WITH_PEANUT },
    },
    {
      id: 'modify-ok',
      label: 'Modify válido',
      desc: 'Um guardrail post ajusta a saída; o resultado é revalidado e segue ok (regra 8).',
      patch: { postModify: 'valid' },
    },
    {
      id: 'modify-broken',
      label: 'Modify quebra o schema',
      desc: 'O guardrail remove `steps`; a revalidação falha → invalid.',
      patch: { postModify: 'broken' },
    },
    {
      id: 'provider-error',
      label: 'ProviderError (infra)',
      desc: 'Falha de rede: exceção propaga, não vira invalid e não consome tentativa (regra 11).',
      patch: { script: '!error: ECONNREFUSED http://localhost:11434' },
    },
    {
      id: 'no-rag',
      label: 'Sem RAG (exemplos vazios)',
      desc: 'Sem embeddings/store o retrieve é pulado e o prompt segue sem exemplos (regra 10).',
      patch: { rag: false },
    },
    {
      id: 'index-mismatch',
      label: 'Índice com outro modelo',
      desc: 'Índice criado com outro modelo de embeddings → erro pedindo reindexação (regra 17).',
      patch: { index: 'model' },
    },
  ];

  window.NutritionPack = { FOODS, RECIPES, DEFAULTS, PRESETS, SEP, createNutritionPack };
})();
