// [Passo 6 · Loader de dataset externo] Testes de `examples/nutrition-pack/load-dataset.ts` (CR-04, CR-03).
// Usam CSVs minúsculos escritos pelo próprio teste (pasta temporária), nunca um dataset real de terceiros.
import { describe, it } from 'vitest';

describe('resolveDatasetDir', () => {
  it.todo('variável ausente ou vazia devolve undefined (pack usa os sintéticos)');
  it.todo('variável apontando para pasta inexistente lança erro com o caminho');
  it.todo('variável válida devolve o caminho');
});

describe('readCsvRows', () => {
  it.todo('mapeia cada linha pelo cabeçalho');
  it.todo('campo entre aspas com vírgula e com quebra de linha é lido como um campo só');
});

describe('loadKnowledgeFromDataset', () => {
  it.todo('converte linhas válidas em KnowledgeItem com text e metadata');
  it.todo('linha que falha no schema é contada em skipped e não derruba a carga');
  it.todo('ids são estáveis: carregar duas vezes gera os mesmos ids');
  it.todo('respeita maxItems');
});

describe('loadNutritionTableFromDataset', () => {
  it.todo('normaliza a chave do alimento (minúsculas, sem acento, sem espaços nas pontas)');
  it.todo('converte kcal por porção ou recusa a coluna, conforme o ColumnMap');
  it.todo('separa alérgenos pelo separador configurado');
});
