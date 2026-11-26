/**
 * [Passo 6 · Teste de arquitetura] Guarda do CR-01, CR-02 e CR-03 sobre o código-fonte de `src/` (critérios de aceite 2 e 6).
 *
 * Percorre `src/**\/*.ts` e lê o conteúdo. Os detectores têm um teste próprio ("detector") para garantir que não são
 * vácuos: se um dia deixarem de flagrar o padrão que deveriam, o teste de arquitetura passaria sem proteger nada.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../src', import.meta.url));

function sourceFiles(): { file: string; content: string }[] {
  return readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
    .filter((relative) => relative.endsWith('.ts'))
    .map((relative) => ({
      file: `src/${relative.replaceAll('\\', '/')}`,
      content: readFileSync(join(SRC_DIR, relative), 'utf8'),
    }));
}

/** Vocabulário do pack de exemplo (Receitas/Nutrição), sem acentos e em minúsculas. */
const DOMAIN_TERMS = [
  'receita',
  'recipe',
  'alimento',
  'nutri',
  'caloria',
  'calorie',
  'kcal',
  'alergen',
  'allergen',
  'amendoim',
  'gluten',
  'ingrediente',
  'ingredient',
];

const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const REGEX_LITERAL = /\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[dgimsuvy]*/g;

/** Literais de regex (ou `new RegExp`) que parecem extrair JSON de texto livre. */
function jsonExtractionPatterns(source: string): string[] {
  const candidates = [
    ...(source.match(REGEX_LITERAL) ?? []),
    ...[...source.matchAll(/new RegExp\(\s*(['"`])(.*?)\1/g)].map((match) => match[2] ?? ''),
  ];
  return candidates.filter(
    (pattern) =>
      (/\\\{/.test(pattern) && /\\\}/.test(pattern)) ||
      pattern.includes('```') ||
      /json/i.test(pattern),
  );
}

describe('arquitetura · core sem domínio', () => {
  it('encontra os arquivos de src/ (a varredura não é vazia)', () => {
    expect(sourceFiles().length).toBeGreaterThan(10);
  });

  it('src/ não contém termos do domínio do pack de exemplo (CR-01)', () => {
    const offenders = sourceFiles().flatMap(({ file, content }) => {
      const text = plain(content);
      return DOMAIN_TERMS.filter((term) => text.includes(term)).map((term) => `${file}: "${term}"`);
    });
    expect(offenders).toEqual([]);
  });

  it('src/ não importa nada de examples/ (CR-01)', () => {
    const importsExamples =
      /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"][^'"]*examples[^'"]*['"]/;
    const offenders = sourceFiles()
      .filter(({ content }) => importsExamples.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('src/ não usa regex para extrair JSON da resposta do modelo (CR-03)', () => {
    const offenders = sourceFiles().flatMap(({ file, content }) =>
      jsonExtractionPatterns(content).map((pattern) => `${file}: ${pattern}`),
    );
    expect(offenders).toEqual([]);
  });

  it('detector de extração de JSON flagra os padrões típicos e ignora regex inofensiva', () => {
    expect(jsonExtractionPatterns('const m = text.match(/\\{[\\s\\S]*\\}/);')).toHaveLength(1);
    expect(
      jsonExtractionPatterns('const m = text.match(/```json\\s*([\\s\\S]*?)```/);'),
    ).toHaveLength(1);
    expect(jsonExtractionPatterns('const re = new RegExp("\\\\{.*\\\\}");')).toHaveLength(1);
    expect(jsonExtractionPatterns('const ok = /^[a-z_][a-z0-9_]*$/.test(name);')).toEqual([]);
  });

  it('nenhum guardrail de política existe em src/ (CR-02)', () => {
    // Um guardrail concreto declara `stage: 'pre'` ou `stage: 'post'`; em src/ só existem os tipos e o executor.
    const concreteGuardrail = /\bstage\s*:\s*['"](?:pre|post)['"]|implements\s+Guardrail\b/;
    const offenders = sourceFiles()
      .filter(({ content }) => concreteGuardrail.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
