// Passo 1 · Toolchain (ADR-010): testes sem rede e sem LLM real; só `*.test.ts` rodam (os `*.contract.ts` são suítes reutilizáveis).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
