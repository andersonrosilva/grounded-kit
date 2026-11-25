// Passo 1 · Toolchain (ADR-010): ESLint flat config com typescript-eslint (formato conforme a documentação atual).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**', 'docs/**', '.claude/**'] },
  {
    files: ['**/*.{js,ts}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      // Esqueleto didático: parâmetros ainda não usados são esperados até você implementar.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
