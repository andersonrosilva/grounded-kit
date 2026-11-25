/**
 * [Passo 6 · Loader opcional de dataset externo (ex.: Kaggle)] Converte arquivos CSV LOCAIS em dados do pack.
 * Cumpre: ADR-009 / CR-04 (dado de terceiros nunca entra no repo; licença registrada em `docs/DATA_SOURCES.md`),
 * CR-01 (este arquivo mora em `examples/`; o core não conhece domínio) e CR-03 (linha inválida é descartada por
 * schema Zod, nunca usada "meio válida").
 *
 * Contexto: o dataset NÃO é dado de treino. Ele alimenta (a) os `KnowledgeItem` que viram embeddings no RAG e
 * (b) a tabela nutricional do validator de calorias. Quem gera os vetores é o port `Embeddings`, não este arquivo.
 *
 * Como o loader se encaixa:
 *   CSV em `PACK_DATA_DIR`  ->  linhas validadas (Zod)  ->  KnowledgeItem[] / tabela alimento->fatos
 *   (sem a variável, ou sem o arquivo)  ->  `resolveDatasetDir` devolve `undefined` e `data.ts` usa os SINTÉTICOS.
 *
 * Os testes NUNCA dependem deste loader com dataset real: usam os sintéticos (ver `tests/examples/`).
 *
 * Treino (ordem sugerida):
 *  1. `resolveDatasetDir`: leia `PACK_DATA_DIR` do `env` recebido (não de `process.env` direto, para testar);
 *     vazio/ausente => `undefined`; preenchido mas a pasta não existe => erro explícito dizendo o caminho já
 *     RESOLVIDO. Caminho relativo vale a partir do diretório de trabalho (ex.: `./data/taco`); no Windows, um caminho
 *     começando com `/` aponta para a raiz do drive atual, não para a pasta do projeto.
 *  2. `readCsvRows`: decida como parsear CSV (campos com vírgula entre aspas, quebras de linha dentro de campo).
 *     Escrever um parser mínimo e testá-lo é exercício válido; adotar uma biblioteca é decisão de dependência
 *     (registre num ADR se for adotar). Devolva linhas como `Record<string, string>` pelo cabeçalho.
 *  3. `loadKnowledgeFromDataset`: para cada linha, valide com o schema derivado do `ColumnMap`; linha inválida é
 *     contada em `skipped` (não quebra a carga). Monte `text` (o que será embedado E mostrado ao modelo) juntando
 *     título + ingredientes + modo de preparo, e deixe o restante em `metadata`. `id` estável: o mesmo dataset deve
 *     produzir os mesmos ids (reindexar = upsert, sem duplicar).
 *  4. `loadNutritionTableFromDataset`: chave normalizada (minúsculas, sem acento, sem espaços nas pontas) para que
 *     o lookup do validator e dos guardrails de alérgenos use a mesma regra dos dois lados.
 *  5. Respeite `maxItems`: embeddings custam uma chamada por lote; comece com 200–500 itens.
 *
 * Dataset escolhido: TACO (Kaggle), só para a tabela nutricional — ver `docs/DATA_SOURCES.md`, fonte 2.
 *  - colunas e unidade: `TACO_FOOD_COLUMNS` (kcal já por 100 g, sem conversão);
 *  - idioma: português. Receitas e mapa de alérgenos são sintéticos em português (`data.ts`), então os nomes dos
 *    alimentos casam com os da TACO; a TACO não tem alérgenos nem receitas;
 *  - formato real do `taco-db-nutrientes.csv` (conferido no arquivo baixado): UTF-8, sem aspas e sem vírgula dentro
 *    de campo; cabeçalho com espaço depois de cada vírgula e vírgula final; linhas com 13 a 15 campos (vírgula final
 *    em quase todas); nomes e valores com espaços sobrando, inclusive duplos ("Coco  verde cru"). Logo `readCsvRows`
 *    precisa fazer trim de cabeçalhos e valores, ignorar campos extras vazios, e o nome deve ter os espaços normalizados;
 *  - `Energia (kcal)`: 590 de 597 linhas são numéricas; as 7 restantes não têm valor utilizável: `NA` (2), vazio (1)
 *    e `*` (4; pela legenda da TACO, "análises em reavaliação"). Todas devem descartar o alimento e contar em
 *    `skipped`. O `Tr` (traço) aparece em outros nutrientes, não em kcal;
 *  - `loadKnowledgeFromDataset` fica sem dataset real por ora (não há fonte de receitas em português); ele serve
 *    quando houver uma, e por isso `RecipeColumnMap` continua sem preenchimento.
 */
import type { KnowledgeItem } from '../../src/retrieval';
import type { NutritionFact } from './data';

/** Nome da variável de ambiente com a pasta local do dataset (consta em `.env.example`; sem valor no repo). */
export const DATASET_DIR_ENV = 'PACK_DATA_DIR';

/** Quais colunas do CSV significam o quê. Preenchido conforme o dataset escolhido (ver DATA_SOURCES.md). */
export interface RecipeColumnMap {
  /** Nome do arquivo CSV dentro da pasta do dataset. */
  file: string;
  /** Coluna com um identificador estável; se o dataset não tiver, use o número da linha (decisão sua). */
  id?: string;
  title: string;
  ingredients: string;
  instructions: string;
  /** Colunas extras que vão para `metadata` (ex.: categoria, tempo de preparo). */
  extra?: readonly string[];
}

export interface FoodColumnMap {
  file: string;
  name: string;
  /** Coluna de energia; informe em `unit` como interpretá-la. */
  energy: string;
  unit: 'kcal-per-100g' | 'kcal-per-serving';
  /** Coluna com alérgenos, se o dataset tiver; separador definido em `allergenSeparator`. */
  allergens?: string;
  allergenSeparator?: string;
}

/** Mapeamento do arquivo `taco-db-nutrientes.csv` da TACO (docs/DATA_SOURCES.md, fonte 2). Sem alérgenos. */
export const TACO_FOOD_COLUMNS: FoodColumnMap = {
  file: 'taco-db-nutrientes.csv',
  name: 'Nome',
  energy: 'Energia (kcal)',
  unit: 'kcal-per-100g',
};

export interface LoadOptions {
  /** Teto de itens carregados (embeddings custam). Padrão à sua escolha; sugestão: 500. */
  maxItems?: number;
}

export interface LoadResult<T> {
  items: T;
  /** Quantas linhas foram lidas do arquivo. */
  rowsRead: number;
  /** Quantas foram descartadas por não passar no schema. Útil para saber se o `ColumnMap` está errado. */
  skipped: number;
}

/**
 * Pasta do dataset local, ou `undefined` quando não configurada (o chamador então usa os dados sintéticos).
 * Recebe o `env` por parâmetro para ser testável sem tocar em `process.env`.
 */
export function resolveDatasetDir(env: Record<string, string | undefined>): string | undefined {
  throw new Error('not implemented');
}

/** Lê um CSV e devolve cada linha como objeto cabeçalho -> valor. */
export function readCsvRows(path: string): Promise<Record<string, string>[]> {
  throw new Error('not implemented');
}

/** Receitas do dataset -> `KnowledgeItem[]` prontos para `indexKnowledge`. */
export function loadKnowledgeFromDataset(
  dir: string,
  columns: RecipeColumnMap,
  options?: LoadOptions,
): Promise<LoadResult<KnowledgeItem[]>> {
  throw new Error('not implemented');
}

/** Alimentos do dataset -> tabela usada pelo validator de calorias e pelos guardrails de alérgenos. */
export function loadNutritionTableFromDataset(
  dir: string,
  columns: FoodColumnMap,
  options?: LoadOptions,
): Promise<LoadResult<Readonly<Record<string, NutritionFact>>>> {
  throw new Error('not implemented');
}
