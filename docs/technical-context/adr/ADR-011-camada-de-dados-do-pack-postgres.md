# ADR-011: Camada de dados do pack de exemplo — Postgres como fonte da verdade, Drizzle e Docker Compose opt-in

**Status:** Aceita · **Data:** 2026-11-25 · **Relacionados:** ADR-001, ADR-004, ADR-009, ADR-010 (emenda pgvector), `epic-003-carga-receitas-postgres`

## Contexto
O pack de exemplo lê receitas de `data.ts` (memória). O autor quer carregá-las, fora dos testes, de um Postgres "o mais
real possível, para aprendizado". O `tech-stack.md` e o ADR-010 deixavam **Docker** e **banco real na suíte padrão** fora
do MVP; este ADR delimita a exceção em vez de revogar a regra.

## Decisão
- **Postgres é a fonte da verdade** das receitas/alimentos/alérgenos do pack de exemplo; o índice vetorial (pgvector) é uma
  cópia derivada e reconstruível.
- **Escopo restrito:** todo código e infraestrutura desta camada vive em `examples/nutrition-pack/db/`. O core (`src/`) não
  importa Drizzle nem `pg` (CR-01) e o port `VectorStore` não muda.
- **Postgres local por Docker Compose** (`examples/nutrition-pack/db/docker-compose.yml`, imagem com pgvector), publicado só
  em `127.0.0.1`. Usuário, senha e banco vêm **exclusivamente** de variáveis de ambiente; a senha não tem valor padrão (CR-04).
- **Acesso por Drizzle ORM sobre `pg`** (`createDb(env)` em `db/client.ts`), com a connection string em `DATABASE_URL`.
  Nunca logada nem incluída em mensagens de erro.
- **`tsx`** executa os scripts TypeScript de `db/` (os imports do projeto são sem extensão).
- **Dependências só de desenvolvimento:** `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `tsx`. Versões fixadas pelo lockfile na
  instalação. `drizzle-kit` gera as migrations; elas são aplicadas por `migrate()` do Drizzle.
- **Testes:** a suíte padrão continua sem banco e sem rede (ADR-010). Integração com o banco real é opt-in via `DATABASE_URL`
  (`describe.skipIf`).

## Consequências
- (+) Fluxo realista (conexão, schema, seed, SELECT, reindexação) sem tocar o core.
- (+) Reprodutível com um comando (`pnpm db:up`).
- (−) Exige Docker na máquina de quem quiser rodar esta parte; quem não quiser continua usando `data.ts`.
- (−) Cinco dependências de desenvolvimento a mais para acompanhar.

## Alternativas consideradas
- Migrations SQL puras + `pg` (mais SQL à mostra, sem ORM) e Prisma (exige `generate` e engine próprio): o autor escolheu Drizzle.
- Postgres já instalado ou serviço gerenciado (Neon/Supabase): menos reprodutível ou dependente de conta e rede.
- Testcontainers na suíte: mantido fora (ADR-010).
