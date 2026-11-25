# DATA_SOURCES — origem e licença dos dados

> Exigido pelo ADR-009 (licenças de dados e segredos) e pela regra crítica CR-04. Dado externo **só é usado depois** de ter
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
| Observação | Valores inventados para estudo; não representam composição nutricional real. As receitas, os alimentos e o mapa ingrediente → alérgeno são escritos em **português**, para casar com a TACO (fonte 2). |

### 2. TACO — Tabela Brasileira de Composição de Alimentos (via Kaggle)

| Campo | Valor |
|---|---|
| Nome | Composição nutricional de alimentos - TACO |
| URL | https://www.kaggle.com/datasets/ispangler/composio-nutricional-de-alimentos-taco |
| Autor / publicador | I.Spangler (upload no Kaggle). Fonte original citada na página: Tabela Brasileira de Composição de Alimentos – TACO [CDD-641.10981] |
| Licença (texto exato da página) | CC0: Public Domain |
| Link da licença | Texto legal do CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/ |
| Data de acesso | 2026-11-25 |
| Versão / data de atualização do dataset | Versão 4 (153,49 kB no total); página indica "Updated 7 years ago" |
| Distribuído no repo? | **Não** (baixado localmente em `data/`, apontado por `PACK_DATA_DIR`) |
| Uso | Tabela nutricional (kcal por 100 g) do validator de calorias do pack de exemplo |
| Arquivo usado | `taco-db-nutrientes.csv` (597 linhas de dados, ids de 1 a 597 sem duplicatas, UTF-8). Os outros 6 arquivos (aminoácidos, ácidos graxos, `taco-db-nutrientes-2.csv` com minerais e vitaminas, `toy-db`) não são usados |
| Colunas usadas | `Nome` (alimento) e `Energia (kcal)`; mapeadas em `TACO_FOOD_COLUMNS` (`examples/nutrition-pack/load-dataset.ts`) |
| Dados pessoais? | Não (tabela de composição de alimentos) |
| Atribuição exigida | CC0 não exige. Por boa prática, citar a TACO como fonte original e o upload de I.Spangler no Kaggle |
| Ressalva de licença | O selo CC0 é o declarado por quem fez o upload; a página não mostra autorização do detentor original da TACO, e a seção "Provenance" não foi lida. Usar **só localmente**; antes de redistribuir qualquer arquivo derivado, conferir os termos de uso da TACO |
| Limitações | Sem coluna de alérgenos (o mapa ingrediente → alérgeno é do pack, em `data.ts`). Em `Energia (kcal)`, 590 das 597 linhas são numéricas; 7 não têm valor utilizável (`NA` em 2, vazio em 1, `*` em 4) e são descartadas. CSV com espaços sobrando e vírgula final (o loader faz trim). É tabela de alimentos, não de receitas. Dados de ~7 anos |

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
