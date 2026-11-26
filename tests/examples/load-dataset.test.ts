// [Passo 6 · Loader de dataset externo] Testes de `examples/nutrition-pack/load-dataset.ts` (CR-04, CR-03).
// Usam CSVs minúsculos escritos pelo próprio teste (pasta temporária), nunca um dataset real de terceiros.
//
// Decisões documentadas aqui:
//  - `readCsvRows` só faz trim de cabeçalhos e valores e ignora colunas extras vazias; normalizar o NOME do alimento
//    (minúsculas, sem acento, espaços colapsados) é trabalho de `loadNutritionTableFromDataset`.
//  - Linha sem valor utilizável (`NA`, vazio, `*`, ou não numérico) na energia é descartada e conta em `skipped`.
//  - `unit: 'kcal-per-serving'` é RECUSADO com erro explícito (o ColumnMap não traz o tamanho da porção).
//  - Alimento sem alérgenos fica sem a propriedade `allergens`; com alérgenos, cada um é normalizado.
//  - Sem coluna de id, o id da receita deriva da posição da linha: é estável entre cargas e único.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadKnowledgeFromDataset,
  loadNutritionTableFromDataset,
  readCsvRows,
  resolveDatasetDir,
  TACO_FOOD_COLUMNS,
  type FoodColumnMap,
  type RecipeColumnMap,
} from '../../examples/nutrition-pack/load-dataset';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'load-dataset-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Escreve um CSV na pasta temporária e devolve o caminho completo. */
function csv(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content, 'utf8');
  return path;
}

describe('resolveDatasetDir', () => {
  it('variável ausente ou vazia devolve undefined (pack usa os sintéticos)', () => {
    expect(resolveDatasetDir({})).toBeUndefined();
    expect(resolveDatasetDir({ PACK_DATA_DIR: '' })).toBeUndefined();
    expect(resolveDatasetDir({ PACK_DATA_DIR: '   ' })).toBeUndefined();
  });

  it('variável apontando para pasta inexistente lança erro com o caminho já resolvido', () => {
    const missing = './pasta-que-nao-existe-xyz';
    expect(() => resolveDatasetDir({ PACK_DATA_DIR: missing })).toThrow(resolve(missing));
  });

  it('variável válida devolve o caminho', () => {
    expect(resolveDatasetDir({ PACK_DATA_DIR: dir })).toBe(resolve(dir));
  });

  it('lê do env recebido, não de process.env', () => {
    const subdir = join(dir, 'outra');
    mkdirSync(subdir);
    expect(resolveDatasetDir({ PACK_DATA_DIR: subdir })).toBe(resolve(subdir));
  });
});

describe('readCsvRows', () => {
  it('mapeia cada linha pelo cabeçalho', async () => {
    const path = csv('simples.csv', 'nome,kcal\nArroz,130\nFeijão,80\n');
    expect(await readCsvRows(path)).toEqual([
      { nome: 'Arroz', kcal: '130' },
      { nome: 'Feijão', kcal: '80' },
    ]);
  });

  it('campo entre aspas com vírgula e com quebra de linha é lido como um campo só', async () => {
    const path = csv(
      'aspas.csv',
      'titulo,preparo\n"Arroz, feijão","passo 1\npasso 2"\nOmelete,bata\n',
    );
    expect(await readCsvRows(path)).toEqual([
      { titulo: 'Arroz, feijão', preparo: 'passo 1\npasso 2' },
      { titulo: 'Omelete', preparo: 'bata' },
    ]);
  });

  it('aspas duplicadas dentro de campo entre aspas viram uma aspa', async () => {
    const path = csv('escape.csv', 'frase\n"ele disse ""oi"""\n');
    expect(await readCsvRows(path)).toEqual([{ frase: 'ele disse "oi"' }]);
  });

  it('aceita fim de linha CRLF, ausência de quebra no fim e ignora linhas em branco', async () => {
    const path = csv('crlf.csv', 'a,b\r\n1,2\r\n\r\n3,4');
    expect(await readCsvRows(path)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('arquivo só com cabeçalho, ou vazio, devolve lista vazia', async () => {
    expect(await readCsvRows(csv('so-cabecalho.csv', 'a,b\n'))).toEqual([]);
    expect(await readCsvRows(csv('vazio.csv', ''))).toEqual([]);
  });

  it('cabeçalho com espaços depois das vírgulas e vírgula final é lido corretamente (trim)', async () => {
    const path = csv(
      'taco-like.csv',
      'Nome, Energia (kcal), Proteína (g),\n Arroz cozido , 128 , 2.5,\n',
    );

    const rows = await readCsvRows(path);

    expect(rows).toEqual([
      { Nome: 'Arroz cozido', 'Energia (kcal)': '128', 'Proteína (g)': '2.5' },
    ]);
    expect(Object.keys(rows[0] ?? {})).toEqual(['Nome', 'Energia (kcal)', 'Proteína (g)']);
  });

  it('arquivo inexistente rejeita', async () => {
    await expect(readCsvRows(join(dir, 'nao-existe.csv'))).rejects.toThrow();
  });
});

describe('loadKnowledgeFromDataset', () => {
  const columns: RecipeColumnMap = {
    file: 'receitas.csv',
    id: 'id',
    title: 'titulo',
    ingredients: 'ingredientes',
    instructions: 'preparo',
    extra: ['categoria'],
  };

  const header = 'id,titulo,ingredientes,preparo,categoria\n';

  it('converte linhas válidas em KnowledgeItem com text e metadata', async () => {
    csv(
      'receitas.csv',
      header +
        'r1,Arroz com feijão,"arroz 150 g; feijão 100 g",Refogue e sirva.,almoço\n' +
        'r2,Omelete,"ovo 100 g; queijo 40 g",Bata e frite.,café\n',
    );

    const result = await loadKnowledgeFromDataset(dir, columns);

    expect(result.rowsRead).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.items).toHaveLength(2);
    const [first] = result.items;
    expect(first?.id).toBe('r1');
    expect(first?.text).toContain('Arroz com feijão');
    expect(first?.text).toContain('arroz 150 g; feijão 100 g');
    expect(first?.text).toContain('Refogue e sirva.');
    expect(first?.metadata).toMatchObject({ title: 'Arroz com feijão', categoria: 'almoço' });
  });

  it('linha que falha no schema é contada em skipped e não derruba a carga', async () => {
    csv(
      'receitas.csv',
      header +
        'r1,Arroz,"arroz 100 g",Cozinhe.,almoço\n' +
        'r2,,"ovo",Frite.,café\n' +
        'r3,Salada,"tomate",Misture.,leve\n',
    );

    const result = await loadKnowledgeFromDataset(dir, columns);

    expect(result.rowsRead).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.items.map((item) => item.id)).toEqual(['r1', 'r3']);
  });

  it('ids são estáveis: carregar duas vezes gera os mesmos ids (com e sem coluna de id)', async () => {
    csv('receitas.csv', header + 'r1,A,"x",p,c\nr2,B,"y",p,c\n');
    const first = await loadKnowledgeFromDataset(dir, columns);
    const second = await loadKnowledgeFromDataset(dir, columns);
    expect(second.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));

    csv('sem-id.csv', 'titulo,ingredientes,preparo,categoria\nA,"x",p,c\nB,"y",p,c\n');
    const semId: RecipeColumnMap = { ...columns, file: 'sem-id.csv' };
    delete semId.id;
    const a = await loadKnowledgeFromDataset(dir, semId);
    const b = await loadKnowledgeFromDataset(dir, semId);
    expect(b.items.map((item) => item.id)).toEqual(a.items.map((item) => item.id));
    expect(new Set(a.items.map((item) => item.id)).size).toBe(2);
    expect(a.items.every((item) => item.id.length > 0)).toBe(true);
  });

  it('respeita maxItems', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => `r${i},Receita ${i},"x",p,c`).join('\n');
    csv('receitas.csv', `${header}${rows}\n`);

    const result = await loadKnowledgeFromDataset(dir, columns, { maxItems: 2 });

    expect(result.items).toHaveLength(2);
  });
});

describe('loadNutritionTableFromDataset', () => {
  const columns: FoodColumnMap = {
    file: 'alimentos.csv',
    name: 'Nome',
    energy: 'Energia',
    unit: 'kcal-per-100g',
  };

  it('normaliza a chave do alimento (minúsculas, sem acento, sem espaços nas pontas)', async () => {
    csv('alimentos.csv', 'Nome,Energia\n  Brócolis Cozido  ,35\nARROZ,130\n');

    const result = await loadNutritionTableFromDataset(dir, columns);

    expect(result.items).toEqual({
      'brocolis cozido': { kcalPer100g: 35 },
      arroz: { kcalPer100g: 130 },
    });
    expect(result.rowsRead).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('recusa a coluna em kcal por porção com erro explícito, conforme o ColumnMap', async () => {
    csv('alimentos.csv', 'Nome,Energia\nBolo,300\n');
    await expect(
      loadNutritionTableFromDataset(dir, { ...columns, unit: 'kcal-per-serving' }),
    ).rejects.toThrow();
  });

  it('separa alérgenos pelo separador configurado (e normaliza cada um)', async () => {
    csv('alimentos.csv', 'Nome,Energia,Alergenos\nPão,250,"glúten;Leite"\nArroz,130,\n');
    const withAllergens: FoodColumnMap = {
      ...columns,
      allergens: 'Alergenos',
      allergenSeparator: ';',
    };

    const result = await loadNutritionTableFromDataset(dir, withAllergens);

    expect(result.items['pao']).toEqual({ kcalPer100g: 250, allergens: ['gluten', 'leite'] });
    expect(result.items['arroz']).toEqual({ kcalPer100g: 130 });
    expect(result.items['arroz']).not.toHaveProperty('allergens');
  });

  it('com TACO_FOOD_COLUMNS: lê Nome e Energia (kcal) de um CSV no formato da TACO', async () => {
    csv(
      TACO_FOOD_COLUMNS.file,
      'Nome, Energia (kcal), Proteína (g),\nArroz tipo 1 cozido, 128, 2.5,\nFeijão carioca cozido, 76, 4.8,\n',
    );

    const result = await loadNutritionTableFromDataset(dir, TACO_FOOD_COLUMNS);

    expect(result.items).toEqual({
      'arroz tipo 1 cozido': { kcalPer100g: 128 },
      'feijao carioca cozido': { kcalPer100g: 76 },
    });
  });

  it('célula NA, vazia ou * (em reavaliação) na energia descarta o alimento e conta em skipped', async () => {
    csv(
      TACO_FOOD_COLUMNS.file,
      'Nome, Energia (kcal), Proteína (g),\n' +
        'Arroz cozido, 128, 2.5,\n' +
        'Abacate cru, NA, 1,\n' +
        'Alface , , 1,\n' +
        'Açúcar mascavo, *, 0,\n' +
        'Feijão cozido, 76, 4.8,\n',
    );

    const result = await loadNutritionTableFromDataset(dir, TACO_FOOD_COLUMNS);

    expect(result.rowsRead).toBe(5);
    expect(result.skipped).toBe(3);
    expect(Object.keys(result.items).sort()).toEqual(['arroz cozido', 'feijao cozido']);
  });

  it('espaços duplos e nas pontas do nome do alimento são normalizados', async () => {
    csv(TACO_FOOD_COLUMNS.file, 'Nome, Energia (kcal),\n Coco   verde  cru , 37,\n');

    const result = await loadNutritionTableFromDataset(dir, TACO_FOOD_COLUMNS);

    expect(result.items).toEqual({ 'coco verde cru': { kcalPer100g: 37 } });
  });

  it('respeita maxItems', async () => {
    csv('alimentos.csv', 'Nome,Energia\nA,10\nB,20\nC,30\nD,40\n');
    const result = await loadNutritionTableFromDataset(dir, columns, { maxItems: 2 });
    expect(Object.keys(result.items)).toHaveLength(2);
  });
});
