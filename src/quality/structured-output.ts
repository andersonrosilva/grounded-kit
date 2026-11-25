/**
 * [Passo 2 · Saída estruturada] Parse + validação por schema (Zod) e execução dos validators do pack.
 * Cumpre: ADR-003, ADR-006. Regras da session: 5, 6, 8. CR-03: sem regex de extração de JSON.
 *
 * Treino:
 *  - `parseStructuredOutput`: `JSON.parse(text)` dentro de try/catch (falha de JSON => `{ ok: false, errors }`),
 *    depois `schema.safeParse`; erros do Zod passam por `formatSchemaErrors`.
 *  - `formatSchemaErrors`: transforma o erro do Zod em frases curtas ("campo x: esperado número") — esse texto
 *    vira o feedback de retry enviado ao modelo.
 *  - `runValidators`: roda todos os validators e devolve a lista de mensagens de falha (vazia = tudo certo).
 */
import type { ZodType } from 'zod';
import type { Validator } from '../core/types';

export type ParseOutcome<T> = { ok: true; data: T } | { ok: false; errors: string[] };

export function parseStructuredOutput<T>(text: string, schema: ZodType<T>): ParseOutcome<T> {
  throw new Error('not implemented');
}

export function formatSchemaErrors(error: unknown): string[] {
  throw new Error('not implemented');
}

export function runValidators<T>(data: T, validators: readonly Validator<T>[]): string[] {
  throw new Error('not implemented');
}
