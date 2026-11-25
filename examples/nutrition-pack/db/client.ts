/**
 * [Epic 003 · Conexão com o banco] Cria a conexão Drizzle + `pg` com o Postgres que guarda os dados do pack.
 * Cumpre: ADR-011, ADR-009 / CR-04 (a connection string vem SÓ do ambiente e nunca aparece em log nem em mensagem de
 * erro) e CR-01 (este arquivo mora em `examples/`; o core não conhece banco nem Drizzle).
 *
 * Recebe o `env` por parâmetro (como `resolveDatasetDir`) para ser testável sem tocar em `process.env`.
 * Não há schema ainda: `db` é o cliente "cru"; quando o schema existir, passe-o em `drizzle({ client, schema })`.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

/** Nome da variável de ambiente com a connection string da fonte da verdade (consta em `.env.example`). */
export const DATABASE_URL_ENV = 'DATABASE_URL';

export interface DbConnection {
  db: NodePgDatabase;
  pool: Pool;
  /** Encerra o pool. Chame ao fim de scripts, ou o processo não termina. */
  close(): Promise<void>;
}

/**
 * Valida `DATABASE_URL` e devolve a conexão. Não abre socket até a primeira consulta (o `Pool` é preguiçoso).
 * Lança `Error` quando a variável falta, está vazia ou não é uma URL `postgres://` / `postgresql://`; a mensagem cita só o
 * NOME da variável, nunca o valor (ele pode conter a senha).
 */
export function createDb(env: Record<string, string | undefined>): DbConnection {
  const connectionString = env[DATABASE_URL_ENV]?.trim();
  if (!connectionString) {
    throw new Error(`${DATABASE_URL_ENV} não definida. Veja .env.example e o passo "pnpm db:up".`);
  }

  let protocol: string;
  try {
    protocol = new URL(connectionString).protocol;
  } catch {
    throw new Error(
      `${DATABASE_URL_ENV} inválida: esperado postgres://usuario:senha@host:porta/banco.`,
    );
  }
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error(
      `${DATABASE_URL_ENV} inválida: o protocolo deve ser postgres:// ou postgresql://.`,
    );
  }

  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool });
  return { db, pool, close: () => pool.end() };
}
