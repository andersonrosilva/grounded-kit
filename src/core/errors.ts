/**
 * [Passo 1 · Erros] Erros de infraestrutura e de configuração (ADR-006).
 * Regras da session: 11 (erro de infraestrutura NÃO consome retry), 5 (pack malformado falha na carga).
 *
 * Treino: implemente os dois construtores guardando os campos extras. Dica: `super(message)` primeiro e
 * defina `this.name` para facilitar o diagnóstico.
 */

/** Falha de rede, autenticação ou timeout ao falar com um provider. Propaga como exceção; não vira `invalid`. */
export class ProviderError extends Error {
  readonly providerId: string;
  override readonly cause?: unknown;

  constructor(message: string, providerId: string, cause?: unknown) {
    super(message);
    throw new Error('not implemented');
  }
}

/** Pack malformado detectado em `definePack` (falha explícita na carga — ADR-005). */
export class PackDefinitionError extends Error {
  readonly issues: readonly string[];

  constructor(message: string, issues: readonly string[]) {
    super(message);
    throw new Error('not implemented');
  }
}
