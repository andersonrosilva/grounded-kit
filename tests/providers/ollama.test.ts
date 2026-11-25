// [Passo 5 · Ollama] Testes de `src/providers/ollama` com `fetch` falso (ADR-008, ADR-010; regras 11, 16).
import { describe, it } from 'vitest';
import { createOllamaEmbeddings, createOllamaProvider } from '../../src/providers/ollama';
import { runEmbeddingsContract } from '../contract/embeddings.contract';
import { runProviderContract } from '../contract/provider.contract';

// `fetch` falso: troque por uma função que devolve Response simuladas quando for implementar.
runProviderContract('ollama', () => createOllamaProvider({ host: 'http://localhost', model: 'modelo-de-teste' }));
runEmbeddingsContract('ollama', () =>
  createOllamaEmbeddings({ host: 'http://localhost', model: 'modelo-de-teste', dimensions: 8 }),
);

describe('createOllamaProvider', () => {
  it.todo('envia o modelo configurado e o prompt para o endpoint de geração');
  it.todo('converte o schema Zod para o formato nativo quando suportado; senão o ignora');
  it.todo('mapeia a contagem de tokens para Usage');
  it.todo('HTTP não-2xx vira ProviderError sem vazar dados sensíveis');
});

describe('createOllamaEmbeddings', () => {
  it.todo('confere a dimensão devolvida com a dimensão configurada');
  it.todo('o id do Embeddings inclui o nome do modelo (regra 16)');
});
