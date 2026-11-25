# ai-kit (grounded-kit)

Motor de IA reutilizável e **agnóstico de domínio**: pipeline `retrieve → generate → validate → moderate`, saída
estruturada (Zod), guardrails e RAG. O domínio entra por um *domain pack*.

> **Estado: esqueleto didático.** Tipos, assinaturas e testes `it.todo` existem; a lógica ainda **não** foi
> implementada (`throw new Error('not implemented')`). Contexto completo em `docs/`.

## Instalação (você roda; o `package.json` não traz versões de propósito)
```powershell
pnpm add zod
pnpm add -D typescript tsup vitest eslint @eslint/js typescript-eslint prettier @types/node
# só quando for implementar o adaptador pgvector:
pnpm add -D pg @types/pg
```
Depois: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`.

## Ordem de implementação (docs/.cortex/sessions/epic-001-mvp-core-pipeline/architecture.md)
| Passo | O que | Arquivos |
|---|---|---|
| 1 | Tipos, ports e `definePack` | `src/core/types.ts`, `errors.ts`, `pack.ts` |
| 2 | Qualidade, prompt e pipeline (com fakes) | `src/quality/*`, `src/core/prompt.ts`, `pipeline.ts`, `tests/fakes/*` |
| 3 | Retrieval: in-memory, ingestão/consulta e pgvector | `src/retrieval/*` |
| 4 | Tracer mínimo | `src/ops/*` |
| 5 | Adaptadores Ollama e Gemini | `src/providers/*` |
| 6 | Pack de exemplo, quickstart e teste de arquitetura | `examples/nutrition-pack/*`, `tests/architecture/*` |

Cada arquivo tem no topo um comentário com o passo, as regras/ADRs que cumpre e dicas de implementação.

## Regras críticas (resumo)
1. O core não conhece domínio. 2. Política fica no pack. 3. Saída sempre validada por schema.
4. Dados só com licença verificada; sem segredos no repositório. Detalhes: `docs/technical-context/briefing/critical-rules.md`.
