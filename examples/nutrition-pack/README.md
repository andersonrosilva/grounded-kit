# Pack de exemplo — Receitas/Nutrição

> **Material didático. Não é aconselhamento nutricional.** Os dados são **sintéticos**, criados neste repositório
> (CR-04). A política (restrições alimentares) vive aqui, não no core (CR-02).

## O que este pack demonstra
| Peça | Onde | Tipo |
|---|---|---|
| Base de conhecimento (RAG) | `data.ts` → `getKnowledgeItems()` | `knowledge` |
| Fato verificável por dado | calorias declaradas ≈ tabela nutricional | `validator` |
| Política | alérgenos declarados pelo usuário | `guardrail` (`pre` e `post`) |
| Saída estruturada | `createNutritionOutputSchema()` | schema Zod |

## Passo a passo (você implementa)
1. `data.ts` — escreva a tabela nutricional e as receitas.
2. `pack.ts` — schema, validator, guardrails e `definePack`.
3. `run.ts` — indexar, consultar e gerar.

Meta: o pack inteiro em ≈ 100 linhas, **sem alterar nada em `src/`**.
