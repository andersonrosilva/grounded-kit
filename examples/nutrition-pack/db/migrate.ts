/**
 * [Epic 003 · Migrations] Aplica no banco as migrations pendentes de `migrations/` (`pnpm db:migrate`).
 * Idempotente: o Drizzle guarda quais já rodaram (tabela `drizzle.__drizzle_migrations`) e pula as aplicadas.
 * Para mudar o schema: edite `schema.ts` → `pnpm db:generate` → `pnpm db:migrate`. Não imprime a connection string (CR-04).
 */
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

async function main(): Promise<void> {
  const { db, close } = createDb(process.env);
  try {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)),
    });
    console.log('Migrations aplicadas.');
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const code = (cause as { code?: string } | null)?.code;
  const detail = cause instanceof Error ? cause.message || code || cause.name : 'erro desconhecido';
  console.error(`Falha ao aplicar migrations: ${detail}`);
  process.exitCode = 1;
});
