/**
 * [Epic 003 · Dados do seed] Receitas, alimentos e alérgenos SINTÉTICOS, em português, no formato das tabelas
 * (estruturado). É o conteúdo que `pnpm db:seed` grava no Postgres. Mesmo conteúdo de `../data.ts` (a fixture dos
 * testes), só que dividido em colunas: lá a receita é um texto pronto; aqui, título + ingredientes + preparo.
 *
 * Quer cadastrar uma receita sua? Acrescente um item em `SEED_RECIPES` (ingredientes com `food` = chave existente em
 * `SEED_FOODS`) e rode `pnpm db:seed` de novo: o seed é idempotente (atualiza o que já existe, sem duplicar).
 *
 * Valores inventados e arredondados para estudo; NÃO é aconselhamento nutricional. Origem: `docs/DATA_SOURCES.md`, fonte 1.
 * Convenção: `key` em minúsculas, sem acento e sem espaços nas pontas; `name` é o nome legível.
 */

/** Vocabulário fechado de alérgenos (minúsculas, sem acento). */
export const SEED_ALLERGENS = ['gluten', 'leite', 'ovo', 'amendoim', 'peixe'] as const;

export interface SeedFood {
  key: string;
  name: string;
  /** Calorias por 100 g (valor sintético). */
  kcalPer100g: number;
  allergens?: readonly (typeof SEED_ALLERGENS)[number][];
}

export interface SeedRecipe {
  id: string;
  title: string;
  instructions: string;
  servings: number;
  /** Em ordem de uso; `food` é a `key` de um alimento de `SEED_FOODS`. */
  ingredients: readonly { food: string; grams: number }[];
}

export const SEED_FOODS: readonly SeedFood[] = [
  { key: 'arroz branco cozido', name: 'Arroz branco cozido', kcalPer100g: 130 },
  { key: 'feijao carioca cozido', name: 'Feijão carioca cozido', kcalPer100g: 80 },
  { key: 'grao-de-bico cozido', name: 'Grão-de-bico cozido', kcalPer100g: 160 },
  { key: 'peito de frango grelhado', name: 'Peito de frango grelhado', kcalPer100g: 160 },
  { key: 'atum em conserva', name: 'Atum em conserva', kcalPer100g: 110, allergens: ['peixe'] },
  { key: 'ovo de galinha', name: 'Ovo de galinha', kcalPer100g: 145, allergens: ['ovo'] },
  {
    key: 'queijo minas frescal',
    name: 'Queijo minas frescal',
    kcalPer100g: 260,
    allergens: ['leite'],
  },
  { key: 'leite integral', name: 'Leite integral', kcalPer100g: 60, allergens: ['leite'] },
  { key: 'aveia em flocos', name: 'Aveia em flocos', kcalPer100g: 390, allergens: ['gluten'] },
  { key: 'goma de tapioca', name: 'Goma de tapioca', kcalPer100g: 240 },
  {
    key: 'pasta de amendoim',
    name: 'Pasta de amendoim',
    kcalPer100g: 590,
    allergens: ['amendoim'],
  },
  { key: 'banana prata', name: 'Banana prata', kcalPer100g: 90 },
  { key: 'tomate', name: 'Tomate', kcalPer100g: 20 },
  { key: 'brocolis cozido', name: 'Brócolis cozido', kcalPer100g: 35 },
  { key: 'cenoura cozida', name: 'Cenoura cozida', kcalPer100g: 35 },
  { key: 'cebola', name: 'Cebola', kcalPer100g: 40 },
  { key: 'alho', name: 'Alho', kcalPer100g: 150 },
  { key: 'azeite de oliva', name: 'Azeite de oliva', kcalPer100g: 880 },
];

export const SEED_RECIPES: readonly SeedRecipe[] = [
  {
    id: 'receita-arroz-com-feijao',
    title: 'Arroz com feijão simples',
    instructions:
      'Refogue a cebola e o alho no azeite, junte o feijão cozido e aqueça por 3 minutos; sirva sobre o arroz.',
    servings: 1,
    ingredients: [
      { food: 'arroz branco cozido', grams: 150 },
      { food: 'feijao carioca cozido', grams: 100 },
      { food: 'cebola', grams: 20 },
      { food: 'alho', grams: 5 },
      { food: 'azeite de oliva', grams: 5 },
    ],
  },
  {
    id: 'receita-omelete-de-queijo',
    title: 'Omelete de queijo',
    instructions:
      'Bata os ovos, aqueça o azeite na frigideira, despeje os ovos, coloque o queijo em cubos no centro, dobre a omelete e deixe 2 minutos.',
    servings: 1,
    ingredients: [
      { food: 'ovo de galinha', grams: 100 },
      { food: 'queijo minas frescal', grams: 40 },
      { food: 'azeite de oliva', grams: 3 },
    ],
  },
  {
    id: 'receita-frango-grelhado-com-legumes',
    title: 'Frango grelhado com legumes',
    instructions:
      'Grelhe o frango até dourar, aqueça os legumes cozidos no azeite por 2 minutos e sirva junto.',
    servings: 1,
    ingredients: [
      { food: 'peito de frango grelhado', grams: 120 },
      { food: 'brocolis cozido', grams: 80 },
      { food: 'cenoura cozida', grams: 60 },
      { food: 'azeite de oliva', grams: 5 },
    ],
  },
  {
    id: 'receita-panqueca-de-aveia-e-banana',
    title: 'Panqueca de aveia e banana com pasta de amendoim',
    instructions:
      'Amasse a banana, misture com a aveia, o ovo e o leite, doure a massa dos dois lados em frigideira antiaderente e cubra com a pasta de amendoim.',
    servings: 1,
    ingredients: [
      { food: 'aveia em flocos', grams: 40 },
      { food: 'banana prata', grams: 100 },
      { food: 'ovo de galinha', grams: 50 },
      { food: 'leite integral', grams: 50 },
      { food: 'pasta de amendoim', grams: 15 },
    ],
  },
  {
    id: 'receita-tapioca-com-queijo-e-tomate',
    title: 'Tapioca com queijo e tomate',
    instructions:
      'Espalhe a goma em frigideira quente até formar o disco, recheie com o queijo e o tomate em fatias e dobre.',
    servings: 1,
    ingredients: [
      { food: 'goma de tapioca', grams: 60 },
      { food: 'queijo minas frescal', grams: 40 },
      { food: 'tomate', grams: 40 },
    ],
  },
  {
    id: 'receita-salada-de-atum-e-grao-de-bico',
    title: 'Salada de atum e grão-de-bico',
    instructions:
      'Escorra o atum, pique o tomate e a cebola, misture tudo com o grão-de-bico e tempere com o azeite.',
    servings: 1,
    ingredients: [
      { food: 'atum em conserva', grams: 80 },
      { food: 'grao-de-bico cozido', grams: 100 },
      { food: 'tomate', grams: 60 },
      { food: 'cebola', grams: 20 },
      { food: 'azeite de oliva', grams: 5 },
    ],
  },
];
