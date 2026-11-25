/**
 * [Epic 003 · Migrations] Configuração do drizzle-kit. `pnpm db:generate` lê `schema.ts` e grava SQL em `migrations/`.
 * `generate` NÃO conecta ao banco (por isso não há credenciais aqui, CR-04); quem aplica as migrations é `pnpm db:migrate`.
 * Os caminhos são relativos à raiz do repositório (de onde o pnpm roda os scripts).
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './examples/nutrition-pack/db/schema.ts',
  out: './examples/nutrition-pack/db/migrations',
});
