/**
 * [Epic 003 · Seed] Insere no Postgres os alimentos (valor nutricional), alérgenos e receitas de `seed-data.ts`
 * (`pnpm db:seed`). Rode `pnpm db:migrate` antes: as tabelas precisam existir.
 *
 * Idempotente (regra 10): rodar N vezes dá o mesmo estado. Alimentos e receitas são atualizados por chave/id; os
 * ingredientes de cada receita são substituídos por inteiro. Tudo numa transação: ou entra tudo, ou nada.
 * Não imprime a connection string (CR-04).
 */
import { count, inArray, sql } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { createDb, type Db } from './client';
import { allergens, foodAllergens, foods, recipeIngredients, recipes } from './schema';
import { SEED_ALLERGENS, SEED_FOODS, SEED_RECIPES } from './seed-data';

export interface SeedSummary {
  allergens: number;
  foods: number;
  recipes: number;
  recipeIngredients: number;
}

/** Grava os dados sintéticos. Devolve quantas linhas existem em cada tabela depois da carga. */
export async function seedSynthetic(db: Db): Promise<SeedSummary> {
  const foodKeys = new Set(SEED_FOODS.map((f) => f.key));
  for (const recipe of SEED_RECIPES) {
    for (const { food } of recipe.ingredients) {
      if (!foodKeys.has(food)) {
        throw new Error(
          `Receita "${recipe.id}" usa o alimento "${food}", que não existe em SEED_FOODS.`,
        );
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(allergens)
      .values(SEED_ALLERGENS.map((code) => ({ code })))
      .onConflictDoNothing();

    await tx
      .insert(foods)
      .values(
        SEED_FOODS.map((f) => ({
          key: f.key,
          name: f.name,
          kcalPer100g: f.kcalPer100g,
          source: 'synthetic',
        })),
      )
      .onConflictDoUpdate({
        target: foods.key,
        set: {
          name: sql`excluded.name`,
          kcalPer100g: sql`excluded.kcal_per_100g`,
          source: sql`excluded.source`,
        },
      });

    await tx
      .insert(foodAllergens)
      .values(
        SEED_FOODS.flatMap((f) =>
          (f.allergens ?? []).map((allergenCode) => ({ foodKey: f.key, allergenCode })),
        ),
      )
      .onConflictDoNothing();

    await tx
      .insert(recipes)
      .values(
        SEED_RECIPES.map((r) => ({
          id: r.id,
          title: r.title,
          instructions: r.instructions,
          servings: r.servings,
        })),
      )
      .onConflictDoUpdate({
        target: recipes.id,
        set: {
          title: sql`excluded.title`,
          instructions: sql`excluded.instructions`,
          servings: sql`excluded.servings`,
          updatedAt: sql`now()`,
        },
      });

    // Ingredientes: apaga e regrava os das receitas do seed (assim, se você mudar uma receita, nada sobra).
    await tx.delete(recipeIngredients).where(
      inArray(
        recipeIngredients.recipeId,
        SEED_RECIPES.map((r) => r.id),
      ),
    );
    await tx.insert(recipeIngredients).values(
      SEED_RECIPES.flatMap((r) =>
        r.ingredients.map((ing, index) => ({
          recipeId: r.id,
          position: index + 1,
          foodKey: ing.food,
          grams: ing.grams,
        })),
      ),
    );
  });

  const total = async (
    table: typeof allergens | typeof foods | typeof recipes | typeof recipeIngredients,
  ) => (await db.select({ n: count() }).from(table))[0]?.n ?? 0;

  return {
    allergens: await total(allergens),
    foods: await total(foods),
    recipes: await total(recipes),
    recipeIngredients: await total(recipeIngredients),
  };
}

async function main(): Promise<void> {
  const { db, close } = createDb(process.env);
  try {
    const summary = await seedSynthetic(db);
    console.log(
      `Seed concluído — alérgenos: ${summary.allergens}, alimentos: ${summary.foods}, receitas: ${summary.recipes}, ingredientes: ${summary.recipeIngredients}.`,
    );
  } finally {
    await close();
  }
}

// Só executa quando chamado como script (`pnpm db:seed`); importar `seedSynthetic` em outro arquivo não dispara a carga.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    const code = (cause as { code?: string } | null)?.code;
    const detail =
      cause instanceof Error ? cause.message || code || cause.name : 'erro desconhecido';
    console.error(`Falha no seed: ${detail}`);
    process.exitCode = 1;
  });
}
