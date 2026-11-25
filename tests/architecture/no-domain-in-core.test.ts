/**
 * [Passo 6 · Teste de arquitetura] Guarda do CR-01 e do CR-03 sobre o código-fonte de `src/` (critérios de aceite 2 e 6).
 *
 * Treino: percorra recursivamente `src/**\/*.ts` (fs) e leia o conteúdo.
 *  - CR-01: nenhum termo do domínio do pack de exemplo (monte a lista a partir do vocabulário de `examples/`).
 *  - CR-03: nenhum padrão de extração de JSON por regex (ex.: uma regex que capture "tudo entre chaves").
 *  - CR-01: nenhum arquivo de `src/` importa de `examples/`.
 */
import { describe, it } from 'vitest';

describe('arquitetura · core sem domínio', () => {
  it.todo('src/ não contém termos do domínio do pack de exemplo (CR-01)');
  it.todo('src/ não importa nada de examples/ (CR-01)');
  it.todo('src/ não usa regex para extrair JSON da resposta do modelo (CR-03)');
  it.todo('nenhum guardrail de política existe em src/ (CR-02)');
});
