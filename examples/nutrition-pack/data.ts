/**
 * [Passo 6 · Dados do pack de exemplo] Receitas e tabela nutricional SINTÉTICAS, em português, criadas neste repo.
 * Cumpre: ADR-009 / CR-04 — nenhum dado de terceiros; valores inventados e arredondados para estudo, sem pretensão
 * de exatidão. Não é aconselhamento nutricional. Origem registrada em `docs/DATA_SOURCES.md` (fonte 1).
 *
 * Convenções (o validator e os guardrails dependem delas):
 *  - Chaves da tabela: nome do alimento em minúsculas, sem acento e sem espaços nas pontas. O loader de dataset
 *    (`load-dataset.ts`) deve aplicar a MESMA regra aos nomes da TACO, para o lookup funcionar dos dois lados.
 *  - Alérgenos: vocabulário fechado, minúsculas e sem acento — gluten, leite, ovo, amendoim, peixe. O guardrail do
 *    pack deve normalizar o que o usuário declarar antes de comparar.
 *  - Todo ingrediente de toda receita existe na tabela, e as calorias declaradas em cada receita são a soma
 *    `gramas x kcal/100 g` pela tabela (arredondada), para os exemplos passarem no próprio validator de calorias.
 */
import type { KnowledgeItem } from '../../src/retrieval';

export interface NutritionFact {
  /** Calorias por 100 g (valor sintético). */
  kcalPer100g: number;
  /** Alérgenos associados ao alimento, se houver. */
  allergens?: readonly string[];
}

const NUTRITION_TABLE: Readonly<Record<string, NutritionFact>> = {
  'arroz branco cozido': { kcalPer100g: 130 },
  'feijao carioca cozido': { kcalPer100g: 80 },
  'grao-de-bico cozido': { kcalPer100g: 160 },
  'peito de frango grelhado': { kcalPer100g: 160 },
  'atum em conserva': { kcalPer100g: 110, allergens: ['peixe'] },
  'ovo de galinha': { kcalPer100g: 145, allergens: ['ovo'] },
  'queijo minas frescal': { kcalPer100g: 260, allergens: ['leite'] },
  'leite integral': { kcalPer100g: 60, allergens: ['leite'] },
  'aveia em flocos': { kcalPer100g: 390, allergens: ['gluten'] },
  'goma de tapioca': { kcalPer100g: 240 },
  'pasta de amendoim': { kcalPer100g: 590, allergens: ['amendoim'] },
  'banana prata': { kcalPer100g: 90 },
  tomate: { kcalPer100g: 20 },
  'brocolis cozido': { kcalPer100g: 35 },
  'cenoura cozida': { kcalPer100g: 35 },
  cebola: { kcalPer100g: 40 },
  alho: { kcalPer100g: 150 },
  'azeite de oliva': { kcalPer100g: 880 },
};

/** Cada texto é embedado E mostrado ao modelo como exemplo: ingredientes com gramas, preparo e calorias. */
const RECIPES: readonly KnowledgeItem[] = [
  {
    id: 'receita-arroz-com-feijao',
    text:
      'Arroz com feijão simples (1 porção). Ingredientes: arroz branco cozido 150 g; feijão carioca cozido 100 g; ' +
      'cebola 20 g; alho 5 g; azeite de oliva 5 g. Preparo: refogue a cebola e o alho no azeite, junte o feijão ' +
      'cozido e aqueça por 3 minutos; sirva sobre o arroz. Calorias: 335 kcal.',
    metadata: { title: 'Arroz com feijão simples', calories: 335 },
  },
  {
    id: 'receita-omelete-de-queijo',
    text:
      'Omelete de queijo (1 porção). Ingredientes: ovo de galinha 100 g; queijo minas frescal 40 g; azeite de ' +
      'oliva 3 g. Preparo: bata os ovos, aqueça o azeite na frigideira, despeje os ovos, coloque o queijo em ' +
      'cubos no centro, dobre a omelete e deixe 2 minutos. Calorias: 275 kcal.',
    metadata: { title: 'Omelete de queijo', calories: 275 },
  },
  {
    id: 'receita-frango-grelhado-com-legumes',
    text:
      'Frango grelhado com legumes (1 porção). Ingredientes: peito de frango grelhado 120 g; brócolis cozido 80 g; ' +
      'cenoura cozida 60 g; azeite de oliva 5 g. Preparo: grelhe o frango até dourar, aqueça os legumes cozidos ' +
      'no azeite por 2 minutos e sirva junto. Calorias: 285 kcal.',
    metadata: { title: 'Frango grelhado com legumes', calories: 285 },
  },
  {
    id: 'receita-panqueca-de-aveia-e-banana',
    text:
      'Panqueca de aveia e banana com pasta de amendoim (1 porção). Ingredientes: aveia em flocos 40 g; banana ' +
      'prata 100 g; ovo de galinha 50 g; leite integral 50 g; pasta de amendoim 15 g. Preparo: amasse a banana, ' +
      'misture com a aveia, o ovo e o leite, doure a massa dos dois lados em frigideira antiaderente e cubra com ' +
      'a pasta de amendoim. Calorias: 437 kcal.',
    metadata: { title: 'Panqueca de aveia e banana com pasta de amendoim', calories: 437 },
  },
  {
    id: 'receita-tapioca-com-queijo-e-tomate',
    text:
      'Tapioca com queijo e tomate (1 porção). Ingredientes: goma de tapioca 60 g; queijo minas frescal 40 g; ' +
      'tomate 40 g. Preparo: espalhe a goma em frigideira quente até formar o disco, recheie com o queijo e o ' +
      'tomate em fatias e dobre. Calorias: 256 kcal.',
    metadata: { title: 'Tapioca com queijo e tomate', calories: 256 },
  },
  {
    id: 'receita-salada-de-atum-e-grao-de-bico',
    text:
      'Salada de atum e grão-de-bico (1 porção). Ingredientes: atum em conserva 80 g; grão-de-bico cozido 100 g; ' +
      'tomate 60 g; cebola 20 g; azeite de oliva 5 g. Preparo: escorra o atum, pique o tomate e a cebola, ' +
      'misture tudo com o grão-de-bico e tempere com o azeite. Calorias: 312 kcal.',
    metadata: { title: 'Salada de atum e grão-de-bico', calories: 312 },
  },
];

/** Tabela alimento -> fatos, usada pelo validator de calorias e pelos guardrails de alérgenos. */
export function getNutritionTable(): Readonly<Record<string, NutritionFact>> {
  return NUTRITION_TABLE;
}

/** Receitas como itens de conhecimento (texto + metadata) para indexar via embeddings. */
export function getKnowledgeItems(): KnowledgeItem[] {
  return [...RECIPES];
}
