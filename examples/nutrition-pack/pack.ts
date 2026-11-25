/**
 * [Passo 6 · Pack de exemplo — Receitas/Nutrição] Consumidor da API pública; o core NUNCA importa este arquivo (CR-01).
 * Aqui mora a POLÍTICA do domínio (CR-02): restrições alimentares. Meta: ≈ 100 linhas no total (critério de aceite 7).
 * AVISO: material didático, não é aconselhamento nutricional.
 *
 * Treino:
 *  - `createNutritionOutputSchema`: schema Zod do `NutritionOutput` (título, ingredientes com gramas, calorias, passos).
 *  - `createNutritionPack`: chame `definePack` com:
 *      prompts   — system com o papel + `user(input, examples)` pedindo o JSON;
 *      knowledge — `items` vindos de `./data` e `toQuery` (ex.: o pedido do usuário);
 *      validators — calorias declaradas ≈ soma pela tabela nutricional sintética (tolerância à sua escolha);
 *      guardrails — `pre`: pedido contém alérgeno declarado? bloqueia; `post`: receita contém alérgeno? bloqueia.
 */
import type { ZodType } from 'zod';
import type { DomainPack } from '../../src/core';

export interface NutritionInput {
  request: string;
  /** Alérgenos que o usuário declarou evitar. */
  allergens: readonly string[];
}

export interface NutritionOutput {
  title: string;
  ingredients: { name: string; grams: number }[];
  calories: number;
  steps: string[];
}

export function createNutritionOutputSchema(): ZodType<NutritionOutput> {
  throw new Error('not implemented');
}

export function createNutritionPack(): DomainPack<NutritionInput, NutritionOutput> {
  throw new Error('not implemented');
}
