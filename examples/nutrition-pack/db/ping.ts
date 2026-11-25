/**
 * [Epic 003 · Conexão com o banco] Teste de fumaça da conexão: abre a conexão, roda `select 1`, mostra a versão do
 * servidor e encerra. Use depois de `pnpm db:up`: `pnpm db:ping`. Não imprime a connection string (CR-04).
 */
import { sql } from 'drizzle-orm';
import { createDb } from './client';

async function main(): Promise<void> {
  const { db, close } = createDb(process.env);
  try {
    await db.execute(sql`select 1`);
    const result = await db.execute<{ version: string }>(sql`select version() as version`);
    console.log(`Conexão OK — ${result.rows[0]?.version ?? 'versão desconhecida'}`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  // O Drizzle embrulha o erro do driver ("Failed query"); a causa (ex.: senha inválida, banco fora do ar) fica em `cause`.
  // Nenhuma das duas mensagens contém a connection string (CR-04).
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  // Banco fora do ar vira um AggregateError sem texto; nesse caso mostramos o `code` (ex.: ECONNREFUSED).
  const code = (cause as { code?: string } | null)?.code;
  const detail = cause instanceof Error ? cause.message || code || cause.name : 'erro desconhecido';
  console.error(`Falha ao conectar: ${detail}`);
  process.exitCode = 1;
});
