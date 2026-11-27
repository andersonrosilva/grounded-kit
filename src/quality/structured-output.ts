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
import { z } from 'zod';
import type { ZodType } from 'zod';
import type { Validator } from '../core/types';

export type ParseOutcome<T> = { ok: true; data: T } | { ok: false; errors: string[] };

export function parseStructuredOutput<T>(text: string, schema: ZodType<T>): ParseOutcome<T> {
  if (!text || text.trim() === '') {
    return { ok: false, errors: ['Saída vazia'] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Falha ao parsear JSON'] };
  }

  const result = schema.safeParse(parsed);

  if (!result.success) {
    return { ok: false, errors: formatSchemaErrors(result.error) };
  }

  return { ok: true, data: result.data };
}

export function formatSchemaErrors(error: unknown): string[] {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
  }

  if (error instanceof Error) {
    return [error.message];
  }

  return [String(error)];
}

export function runValidators<T>(data: T, validators: readonly Validator<T>[]): string[] {
  if (validators.length === 0) {
    return [];
  }

  const errors: string[] = [];

  for (const validator of validators) {
    const result = validator.validate(data);
    
    if (!result.ok) {
      errors.push(result.error);
    }
  }
  
  return errors;
}
