/**
 * [Passo 6 · Dados do pack de exemplo] Receitas e tabela nutricional SINTÉTICAS, criadas por você neste repo.
 * Cumpre: ADR-009 / CR-04 — nenhum dado de terceiros; valores inventados para estudo, sem pretensão de exatidão.
 *
 * Treino: escreva ~5 receitas curtas e ~15 alimentos (kcal por 100 g). Comece pequeno; o objetivo é exercitar o
 * RAG e o validator, não ter uma base completa.
 */
import type { KnowledgeItem } from '../../src/retrieval';

export interface NutritionFact {
  /** Calorias por 100 g (valor sintético). */
  kcalPer100g: number;
  /** Alérgenos associados ao alimento, se houver. */
  allergens?: readonly string[];
}

/** Tabela alimento -> fatos, usada pelo validator de calorias e pelos guardrails de alérgenos. */
export function getNutritionTable(): Readonly<Record<string, NutritionFact>> {
  throw new Error('not implemented');
}

/** Receitas como itens de conhecimento (texto + metadata) para indexar via embeddings. */
export function getKnowledgeItems(): KnowledgeItem[] {
  throw new Error('not implemented');
}
