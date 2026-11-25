# DATA_SOURCES — origem e licença dos dados

> Exigido pelo [ADR-009](technical-context/adr/ADR-009-licencas-de-dados-e-segredos.md) e pela regra CR-04
> ([critical-rules.md](technical-context/briefing/critical-rules.md)). Dado externo **só é usado depois** de ter
> uma entrada aqui com a licença conferida.

## Regras de uso

1. **Licença conferida na página oficial do dataset, por você, antes do primeiro uso.** Licença ausente, `Unknown`
   ou `Other` = não usar.
2. **Dataset que exige login para baixar (caso do Kaggle) nunca é commitado.** Fica numa pasta local ignorada pelo
   git (`/data/`) e o pack lê o caminho de `PACK_DATA_DIR`. O repositório guarda apenas a *referência*.
3. **Os testes não dependem de dataset externo.** Eles usam os dados sintéticos de
   `examples/nutrition-pack/data.ts`.
4. **Atribuição registrada** na entrada, exatamente como a licença pede (autor, título, link, licença).
5. **Licenças com share-alike (ex.: CC BY-SA) ou não comerciais (CC BY-NC)** são incompatíveis com o objetivo de
   distribuir o kit como open source permissivo: use apenas localmente, sem redistribuir, e anote a restrição.
6. **Dados pessoais:** conferir se o dataset tem nomes, e-mails ou textos de usuários. Se tiver, não usar sem
   política explícita do pack (CR-04, ADR-007).

## Checklist antes de adicionar uma fonte

- [ ] Licença lida na página do dataset e copiada abaixo (com o link).
- [ ] A licença permite o uso pretendido (estudo local / exemplo distribuído).
- [ ] Sem dados pessoais, ou tratamento definido.
- [ ] Colunas relevantes identificadas e mapeadas em `examples/nutrition-pack/load-dataset.ts`.
- [ ] Arquivo baixado para `data/` (ignorado pelo git) e **não** adicionado ao commit.

## Fontes registradas

### 1. Dados sintéticos do pack de exemplo

| Campo | Valor |
|---|---|
| Origem | Criados neste repositório (`examples/nutrition-pack/data.ts`) |
| Autor | Autor do repositório |
| Licença | Mesma do repositório (a definir; ver decisão pendente do `LICENSE`) |
| Distribuído no repo? | Sim |
| Uso | Testes, quickstart e playground |
| Observação | Valores inventados para estudo; não representam composição nutricional real. |

### 2. Dataset do Kaggle (a preencher)

> Nenhum dataset escolhido ainda. Copie o modelo abaixo quando decidir e **só então** use o dado.

| Campo | Valor |
|---|---|
| Nome | _a preencher_ |
| URL | _a preencher_ |
| Autor / publicador | _a preencher_ |
| Licença (texto exato da página) | _a preencher_ |
| Link da licença | _a preencher_ |
| Data de acesso | _AAAA-MM-DD_ |
| Versão / data de atualização do dataset | _a preencher_ |
| Distribuído no repo? | **Não** (baixado localmente em `data/`) |
| Uso | RAG (`KnowledgeItem`) e/ou tabela nutricional do validator |
| Colunas usadas | _a preencher_ (devem bater com o `ColumnMap` do loader) |
| Dados pessoais? | _sim/não_ |
| Atribuição exigida | _a preencher_ |
| Observação | _a preencher_ |

## Modelo para novas fontes

```markdown
### N. <Nome do dataset>

| Campo | Valor |
|---|---|
| Nome | |
| URL | |
| Autor / publicador | |
| Licença (texto exato da página) | |
| Link da licença | |
| Data de acesso | |
| Versão / data de atualização do dataset | |
| Distribuído no repo? | Sim / Não |
| Uso | |
| Colunas usadas | |
| Dados pessoais? | |
| Atribuição exigida | |
| Observação | |
```
