// [Passo 1 · Erros] Testes de `src/core/errors.ts` (ADR-006; regras 5 e 11). Escreva o teste antes da implementação.
import { describe, expect, it } from 'vitest';
import { PackDefinitionError, ProviderError } from '../../src/core';

describe('ProviderError', () => {
  it("provider", () => {
    const error = new ProviderError('Test message', 'test-provider');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.name).toBe('ProviderError');
  });
  it('guarda message e providerId', () => {
    const error = new ProviderError('Test message', 'test-provider');
    expect(error.message).toBe('Test message');
    expect(error.providerId).toBe('test-provider');
  });
  it('preserva a causa original quando informada', () => {
    const cause = new Error('Original error');
    const error = new ProviderError('Test message', 'test-provider', cause);
    expect(error.cause).toBe(cause);
  });
  it('cause fica undefined quando não informada', () => {
    const error = new ProviderError('Test message', 'test-provider');
    expect(error.cause).toBeUndefined();
  });
});

describe('PackDefinitionError', () => {
  it('é instância de Error e de PackDefinitionError', () => {
    const error = new PackDefinitionError('Test message', ['Issue 1']);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PackDefinitionError);
  });
  it('tem name "PackDefinitionError"', () => {
    const error = new PackDefinitionError('Test message', ['Issue 1']);
    expect(error.name).toBe('PackDefinitionError');
  });
  it('guarda message e a lista completa de issues', () => {
    const issues = ['Issue 1', 'Issue 2'];
    const error = new PackDefinitionError('Test message', issues);
    expect(error.message).toBe('Test message');
    expect(error.issues).toEqual(issues);
  });
  it('aceita lista de issues vazia', () => {
    const error = new PackDefinitionError('Test message', []);
    expect(error.issues).toEqual([]);
  });
});
