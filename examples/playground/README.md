# Playground do grounded-kit

Interface web para aprender a consumir o kit: visão geral, passo a passo com código copiável, playground
interativo e referência da API. Sem dependências extras e sem build: HTML/CSS/JS puros.

## Como rodar

Na raiz do repositório (Node ≥ 22):

```powershell
pnpm playground
```

Abra <http://localhost:5173>. Outra porta: `pnpm playground -- --port 5174`.

Sem pnpm: `node examples/playground/serve.mjs`. Também funciona abrir `examples/playground/index.html`
direto no navegador (duplo clique), pois os scripts não usam módulos ES.

## O que tem

| Aba               | Conteúdo                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Visão geral       | O que o kit faz, fluxo do pipeline, motor × domínio, regras críticas, instalação                        |
| Passo a passo     | 9 passos (instalar → schema → política → pack → providers → indexar → tracer → rodar → script completo) |
| Playground        | Pipeline interativo com 11 cenários prontos, linha do tempo, prompts, RAG, tracer e código equivalente  |
| Referência da API | Todos os subpaths de `exports`, com assinatura, parâmetros, retorno, ADRs e `arquivo:linha` de `src/`   |

## Importante: o playground roda em modo mock

O `src/` do kit ainda é um **esqueleto didático**: toda função lança `not implemented`
(confirmado também contra o `dist/`). Por isso:

- O playground usa `kit-sim.js`, uma **reimplementação de referência em JS puro** que segue os comentários
  "Treino"/"Roteiro" de cada módulo (ADRs e regras da session). Nomes, assinaturas e formatos de retorno
  espelham o kit; o código **não é** o do kit.
- O "modelo" é um `FakeProvider` roteirizado por você e os embeddings são um fake determinístico. Nenhuma
  chave, API ou rede é usada.
- O pack de receitas/nutrição (`nutrition-pack.js`) usa dados **sintéticos**. Não é aconselhamento nutricional.
- Os trechos TypeScript do passo a passo (`content.js`) são **código real**: foram checados com `tsc` contra
  os tipos de `src/` (cada passo isolado e o script completo).

Quando o kit for implementado, troque `kit-sim.js` pelos imports de `ai-kit/*` (o `dist/`) e mantenha a UI.

## Arquivos

| Arquivo                    | Papel                                                  |
| -------------------------- | ------------------------------------------------------ |
| `index.html`, `styles.css` | Estrutura e tema (claro/escuro automático, responsivo) |
| `app.js`                   | Navegação por hash, passo a passo, playground e API    |
| `content.js`               | Trechos TypeScript e referência da API                 |
| `kit-sim.js`               | Simulação de referência do kit (mock)                  |
| `nutrition-pack.js`        | Pack de exemplo, dados sintéticos e cenários           |
| `serve.mjs`                | Servidor estático mínimo (só módulos nativos do Node)  |

Nada em `src/` foi alterado. A única mudança fora desta pasta é o script `playground` no `package.json`.
