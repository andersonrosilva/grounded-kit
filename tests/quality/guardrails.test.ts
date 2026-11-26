// [Passo 2 · Guardrails] Testes de `src/quality/guardrails.ts` (ADR-002; regras 3, 7, 8).
//
// Decisão documentada: com vários `modify`, o resultado traz o output do ÚLTIMO e o `guardrailId` dele.
import { describe, expect, it, vi } from 'vitest';
import type {
  Guardrail,
  GuardrailContext,
  GuardrailStage,
  GuardrailVerdict,
} from '../../src/core/types';
import { runGuardrails } from '../../src/quality';

type In = { q: string };
type Out = { answer: string };

function guardrail(
  id: string,
  stage: GuardrailStage,
  verdict: GuardrailVerdict = { action: 'allow' },
) {
  const check = vi.fn(
    async (_ctx: GuardrailContext<In, Out>): Promise<GuardrailVerdict> => verdict,
  );
  const value: Guardrail<In, Out> = { id, stage, check };
  return Object.assign(value, { check });
}

const INPUT: In = { q: 'pedido' };
const OUTPUT: Out = { answer: 'resposta' };

describe('runGuardrails', () => {
  it('sem guardrails devolve allow', async () => {
    expect(await runGuardrails(undefined, 'pre', { input: INPUT })).toEqual({ action: 'allow' });
    expect(await runGuardrails([], 'post', { input: INPUT, output: OUTPUT })).toEqual({
      action: 'allow',
    });
  });

  it('todos permitindo devolve allow', async () => {
    const result = await runGuardrails([guardrail('a', 'pre'), guardrail('b', 'pre')], 'pre', {
      input: INPUT,
    });
    expect(result).toEqual({ action: 'allow' });
  });

  it('executa só os guardrails do estágio pedido', async () => {
    const pre = guardrail('pre-1', 'pre', { action: 'block', reason: 'não deveria rodar em post' });
    const post = guardrail('post-1', 'post');

    const result = await runGuardrails([pre, post], 'post', { input: INPUT, output: OUTPUT });

    expect(result).toEqual({ action: 'allow' });
    expect(pre.check).not.toHaveBeenCalled();
    expect(post.check).toHaveBeenCalledTimes(1);
  });

  it('entrega o contexto recebido ao check', async () => {
    const post = guardrail('post-1', 'post');
    const ctx = { input: INPUT, output: OUTPUT };

    await runGuardrails([post], 'post', ctx);

    expect(post.check).toHaveBeenCalledWith(ctx);
  });

  it('o primeiro block interrompe e informa reason e guardrailId', async () => {
    const first = guardrail('g1', 'pre');
    const blocker = guardrail('g2', 'pre', { action: 'block', reason: 'alérgeno declarado' });
    const never = guardrail('g3', 'pre');

    const result = await runGuardrails([first, blocker, never], 'pre', { input: INPUT });

    expect(result).toEqual({ action: 'block', reason: 'alérgeno declarado', guardrailId: 'g2' });
    expect(never.check).not.toHaveBeenCalled();
  });

  it('modify devolve o output novo e o guardrailId', async () => {
    const modifier = guardrail('mod', 'post', { action: 'modify', output: { answer: 'editada' } });

    const result = await runGuardrails([modifier], 'post', { input: INPUT, output: OUTPUT });

    expect(result).toEqual({ action: 'modify', output: { answer: 'editada' }, guardrailId: 'mod' });
  });

  it('modify substitui o output para os guardrails seguintes e o resultado traz o último', async () => {
    const first = guardrail('m1', 'post', { action: 'modify', output: { answer: 'v1' } });
    const second = guardrail('m2', 'post', { action: 'modify', output: { answer: 'v2' } });
    const observer = guardrail('obs', 'post');

    const result = await runGuardrails([first, second, observer], 'post', {
      input: INPUT,
      output: OUTPUT,
    });

    expect(second.check).toHaveBeenCalledWith({ input: INPUT, output: { answer: 'v1' } });
    expect(observer.check).toHaveBeenCalledWith({ input: INPUT, output: { answer: 'v2' } });
    expect(result).toEqual({ action: 'modify', output: { answer: 'v2' }, guardrailId: 'm2' });
  });

  it('block depois de um modify prevalece (sem conteúdo parcial)', async () => {
    const modifier = guardrail('mod', 'post', { action: 'modify', output: { answer: 'editada' } });
    const blocker = guardrail('blk', 'post', { action: 'block', reason: 'política' });

    const result = await runGuardrails([modifier, blocker], 'post', {
      input: INPUT,
      output: OUTPUT,
    });

    expect(result).toEqual({ action: 'block', reason: 'política', guardrailId: 'blk' });
  });

  it('guardrails rodam em ordem de declaração', async () => {
    const order: string[] = [];
    const make = (id: string): Guardrail<In, Out> => ({
      id,
      stage: 'pre',
      check: async () => {
        order.push(id);
        return { action: 'allow' };
      },
    });

    await runGuardrails([make('c'), make('a'), make('b')], 'pre', { input: INPUT });

    expect(order).toEqual(['c', 'a', 'b']);
  });
});
