// Passo 1 · Toolchain (ADR-004, ADR-010): gera ESM + CJS + .d.ts, uma entrada por subpath de `exports`.
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'retrieval/index': 'src/retrieval/index.ts',
    'retrieval/pgvector/index': 'src/retrieval/pgvector/index.ts',
    'quality/index': 'src/quality/index.ts',
    'ops/index': 'src/ops/index.ts',
    'providers/ollama/index': 'src/providers/ollama/index.ts',
    'providers/gemini/index': 'src/providers/gemini/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
});
