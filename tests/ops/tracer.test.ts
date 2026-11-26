// [Passo 4 · Tracer] Testes de `src/ops/tracer.ts` (ADR-007; regra 12; CR-04).
//
// Decisão documentada: o tracer de console escreve JSON "achatado": `{ "event": <nome>, ...dados }`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConsoleTracer, createNoopTracer } from '../../src/ops';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createNoopTracer', () => {
  it('event não lança e não escreve nada', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const tracer = createNoopTracer();

    expect(() => tracer.event('pipeline.start', { attempts: 1 })).not.toThrow();
    expect(tracer.event('pipeline.end', {})).toBeUndefined();
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});

describe('createConsoleTracer', () => {
  function recorded() {
    const lines: string[] = [];
    return { lines, tracer: createConsoleTracer({ log: (line) => void lines.push(line) }) };
  }

  it('escreve uma linha JSON por evento via log injetado', () => {
    const { lines, tracer } = recorded();

    tracer.event('pipeline.start', {});
    tracer.event('pipeline.end', {});

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).not.toContain('\n');
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('inclui o nome do evento e os dados numéricos (tokens, latência)', () => {
    const { lines, tracer } = recorded();

    tracer.event('generate.attempt', {
      attempt: 2,
      inputTokens: 26,
      outputTokens: 290,
      latencyMs: 120,
    });

    expect(JSON.parse(lines[0]!)).toMatchObject({
      event: 'generate.attempt',
      attempt: 2,
      inputTokens: 26,
      outputTokens: 290,
      latencyMs: 120,
    });
  });

  it('descarta chaves que carregam conteúdo (prompt, text, output)', () => {
    const { lines, tracer } = recorded();

    tracer.event('generate.attempt', {
      attempt: 1,
      prompt: 'PROMPT-SECRETO',
      text: 'TEXTO-SECRETO',
      output: { answer: 'SAIDA-SECRETA' },
    });

    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed).toMatchObject({ event: 'generate.attempt', attempt: 1 });
    expect(parsed).not.toHaveProperty('prompt');
    expect(parsed).not.toHaveProperty('text');
    expect(parsed).not.toHaveProperty('output');
    for (const secret of ['PROMPT-SECRETO', 'TEXTO-SECRETO', 'SAIDA-SECRETA']) {
      expect(lines[0]).not.toContain(secret);
    }
  });

  it('não altera o objeto de dados recebido', () => {
    const { tracer } = recorded();
    const data = { attempt: 1, prompt: 'conteúdo' };

    tracer.event('generate.attempt', data);

    expect(data).toEqual({ attempt: 1, prompt: 'conteúdo' });
  });

  it('sem `log` informado, usa console.log', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    createConsoleTracer().event('pipeline.start', { attempt: 1 });

    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ event: 'pipeline.start' });
  });
});
