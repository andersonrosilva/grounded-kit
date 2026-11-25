/**
 * [Passo 2 · Contrato do port Guardrail] Suíte reutilizável para qualquer guardrail (os do pack de exemplo, por ex.).
 * Cumpre: ADR-002, critério de aceite 8. Regras da session: 3, 7, 8.
 */
import { describe, it } from 'vitest';
import type { Guardrail } from '../../src/core/types';

export function runGuardrailContract(name: string, makeGuardrail: () => Guardrail): void {
  describe(`contrato Guardrail · ${name}`, () => {
    it.todo('expõe id não vazio e stage "pre" ou "post"');
    it.todo('check devolve sempre um veredito válido (allow | block | modify)');
    it.todo('block traz um motivo legível');
    it.todo('modify traz um output (será revalidado pelo pipeline)');
    it.todo('estágio "pre" funciona sem output no contexto');
  });
}
