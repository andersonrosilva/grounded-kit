/**
 * [Epic 003 · Schema] Tabelas do pack de exemplo no Postgres (fonte da verdade). Decisão: ADR-011.
 * CR-01: o schema mora em `examples/`; o core não conhece estas tabelas. CR-02: aqui fica o DADO de alérgenos; a
 * REGRA de bloquear continua no guardrail de `pack.ts`.
 *
 * Mapa:
 *   allergens ◄── food_allergens ──► foods ◄── recipe_ingredients ──► recipes
 *
 * Convenções (iguais às de `data.ts`):
 *  - `foods.key`: nome do alimento em minúsculas, sem acento, sem espaços nas pontas — é a chave de lookup do validator.
 *  - `foods.kcal_per_100g`: valor nutricional por 100 g. Calorias de uma receita NÃO são coluna: são a soma
 *    gramas × kcal/100 g dos ingredientes (uma fonte da verdade só).
 *  - Alérgenos: vocabulário fechado na tabela `allergens` (gluten, leite, ovo, amendoim, peixe).
 *
 * Mudou o schema? `pnpm db:generate` cria uma nova migration; nunca edite uma migration já aplicada (regra 11).
 */
import {
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/** Vocabulário fechado de alérgenos. */
export const allergens = pgTable('allergens', {
  code: text('code').primaryKey(),
});

/** Alimentos e valor nutricional. `source` diz de onde veio a linha: 'synthetic' (seed) ou 'taco' (carga futura). */
export const foods = pgTable('foods', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  kcalPer100g: doublePrecision('kcal_per_100g').notNull(),
  source: text('source').notNull().default('synthetic'),
});

/** Mapa alimento → alérgeno (um alimento pode ter vários). */
export const foodAllergens = pgTable(
  'food_allergens',
  {
    foodKey: text('food_key')
      .notNull()
      .references(() => foods.key, { onDelete: 'cascade' }),
    allergenCode: text('allergen_code')
      .notNull()
      .references(() => allergens.code, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.foodKey, t.allergenCode] })],
);

/** Receitas. `id` é estável: será o `KnowledgeItem.id` e o id do vetor no índice. */
export const recipes = pgTable('recipes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  instructions: text('instructions').notNull(),
  servings: integer('servings').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Ingredientes de cada receita, em ordem (`position`), com gramas. Todo ingrediente precisa existir em `foods`. */
export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    foodKey: text('food_key')
      .notNull()
      .references(() => foods.key),
    grams: doublePrecision('grams').notNull(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.position] })],
);
