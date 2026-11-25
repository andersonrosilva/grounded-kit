# Context: epic-003-carga-receitas-postgres — Carga das receitas a partir de um Postgres real

## Objetivo
Fazer o pack de exemplo (`examples/nutrition-pack/`) obter receitas, alimentos e alérgenos de um **Postgres como fonte da
verdade** (schema, migrations, seed e SELECT reais), indexá-los em um índice pgvector **derivado e reconstruível**, tudo fora
dos testes padrão, de modo que `pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm db:reindex` deixe o pack pronto para
consulta, para fins de aprendizado.

> Modo **didático** (decisão do autor): este epic entrega só **assinaturas, contratos e `it.todo`**; a lógica é
> implementada pelo autor. O Strategy não escreve código de produção.

### Critérios de aceite (verificáveis)
1. `pnpm db:up` sobe um Postgres com a extensão pgvector via Docker Compose lendo usuário, senha e banco **apenas de variáveis de ambiente**; sem as variáveis obrigatórias o comando falha com mensagem clara; nenhuma senha existe em arquivo versionado.
2. `pnpm db:generate` gera migrations SQL a partir do schema Drizzle e `pnpm db:migrate` cria, em banco limpo, as tabelas `foods`, `allergens`, `food_allergens`, `recipes` e `recipe_ingredients`; rodar `db:migrate` de novo não altera nada.
3. `pnpm db:seed` carrega os 18 alimentos, as 6 receitas e o vocabulário de alérgenos sintéticos; rodar duas vezes mantém exatamente as mesmas contagens (idempotente).
4. Com `PACK_DATA_DIR` apontando para a TACO, `pnpm db:seed -- --taco` adiciona os alimentos da TACO **sem alterar nenhuma chave já existente** (as sintéticas prevalecem) e relata `rowsRead` e `skipped` (597 linhas lidas; 7 descartadas por energia inutilizável).
5. `loadPackDataFromDb(db)` devolve `{ items: KnowledgeItem[]; table }` equivalentes ao que `data.ts` expõe (mesmos ids, títulos, calorias e ingredientes) quando só há dados sintéticos; calorias vêm da soma gramas × kcal pela tabela, não de coluna duplicada.
6. `createNutritionPack(data?)` aceita `{ items, table }` por parâmetro; sem argumento mantém o comportamento atual (usa `data.ts`).
7. `pnpm db:reindex` reconstrói o índice vetorial do pack a partir do banco: a contagem de vetores é igual ao número de receitas; uma receita removida do banco desaparece do índice após o reindex; rodar duas vezes não duplica.
8. `pnpm test` passa **sem rede e sem banco** (testes de integração ficam `skip`); com `DATABASE_URL` definida, a suíte de integração roda em um schema temporário e o remove ao final.
9. `pnpm typecheck`, `eslint` e `prettier` passam; **nenhum arquivo de `src/` é alterado**; o teste de arquitetura (CR-01/CR-03) continua passando.
10. Varredura de segredos local limpa; `.env.example` contém só nomes de variáveis; `.env` permanece ignorado.

## Escopo
**Incluído:**
- Camada de dados do pack em `examples/nutrition-pack/db/`: schema Drizzle, migrations versionadas, `docker-compose.yml`, cliente por variável de ambiente, seed estruturado, mapeadores puros, `loadPackDataFromDb` (SELECT) e `rebuildIndex`.
- Injeção de dados em `createNutritionPack(data?)` e uso opcional do banco em `run.ts`.
- Carga inicial da tabela de alimentos pela TACO (via `load-dataset.ts`), com política "sintético prevalece".
- Índice vetorial no **mesmo** Postgres, em tabela separada (adaptador `createPgVectorStore` do epic-001), reconstruído por reindexação completa.
- ADR-011 (camada de dados do pack), atualização de `tech-stack.md`, `adrs-summary.md`, `DATA_SOURCES.md`, `.env.example`, `package.json` (dependências de desenvolvimento e scripts `db:*`).
- Testes: unitários sem banco (mapeadores, consistência seed × `data.ts`, injeção no pack, reindex com fakes) e integração opt-in via `DATABASE_URL`; tudo como assinaturas + `it.todo`.

**Excluído:**
- Qualquer alteração em `src/` (incluindo o port `VectorStore`: **sem `delete(ids)`**; fica como follow-up com emenda de ADR).
- Docker/Testcontainers na suíte padrão, CI, hospedagem do banco, serviços gerenciados (Neon/Supabase).
- Receitas a partir de dataset externo (não há fonte em português); `loadKnowledgeFromDataset` segue sem uso.
- Tabela de aliases para casar nomes das receitas com os da TACO (follow-up).
- Reindexação incremental/blue-green (follow-up); autenticação/multi-tenant; API HTTP sobre o banco.
- Distribuir o banco ou arquivos derivados da TACO (carga somente local).
- Mover o `data.ts`: ele permanece como fixture dos testes e fonte padrão sem banco.

## Regras de Negócio
1. **Postgres é a fonte da verdade; o índice vetorial é derivado, descartável e reconstruível a partir dele.** — Fonte: decisão do autor (2026-11-25).
2. **Conexão apenas por variável de ambiente** (`DATABASE_URL` para a fonte; `PGVECTOR_URL` para o índice, podendo ter o mesmo valor); `POSTGRES_USER/PASSWORD/DB` só alimentam o Compose, sem valor padrão para a senha. Connection string nunca é logada nem enviada ao tracer. — Fonte: CR-04, ADR-009, regra 18 do epic-001.
3. **Testes padrão sem rede e sem banco**; integração real é opt-in (`describe.skipIf(!DATABASE_URL)`) e usa schema temporário, sem tocar dados do autor. — Fonte: ADR-010 (e emenda de 2026-11-25).
4. **Todo código de acesso a dados mora em `examples/nutrition-pack/`**; o core não importa Drizzle nem conhece tabelas; o único elo com o índice é o adaptador `createPgVectorStore` do epic-001. — Fonte: CR-01, ADR-001.
5. **Id estável**: `recipes.id` é o `KnowledgeItem.id` e o `VectorItem.id`; reindexar o mesmo banco produz os mesmos ids. — Fonte: `load-dataset.ts` (passo 3), indexação do `knowledge` no epic-001 (regra 10).
6. **Calorias são derivadas**, nunca duplicadas: soma de gramas × `kcal_per_100g` dos ingredientes (arredondada); `recipe_ingredients.food_key` tem FK para `foods.key`, então todo ingrediente existe na tabela. — Fonte: convenções de `data.ts`.
7. **Chave de alimento normalizada** (minúsculas, sem acento, sem espaços nas pontas e sem espaços duplos), a mesma regra dos dois lados (banco e validator/guardrails). — Fonte: `data.ts`, `load-dataset.ts`.
8. **Alérgenos: o dado vive no banco, a política vive no pack.** Vocabulário fechado na tabela `allergens` (gluten, leite, ovo, amendoim, peixe); o guardrail continua em `pack.ts`. — Fonte: CR-01, CR-02.
9. **Carga TACO**: só adiciona chaves inexistentes; em conflito vale o sintético; linha com energia `NA`, vazia ou `*` é descartada e contada em `skipped`; uso somente local. — Fonte: decisão do autor, `docs/DATA_SOURCES.md`, CR-04.
10. **Seed idempotente** (upsert por chave/id): rodar N vezes dá o mesmo estado. — Fonte: boa prática de carga; critério 3.
11. **Migrations são geradas por `drizzle-kit`, versionadas e nunca editadas depois de aplicadas**; mudança de schema = nova migration. — Fonte: ADR-011 (a criar neste epic).
12. **Reindexação = reconstrução completa do índice do pack a partir do banco**, sem alterar o port `VectorStore`; se o `embeddingsId`/dimensão do índice divergir do `Embeddings` em uso, o índice é recriado (não misturado). — Fonte: regras 16–17 do epic-001; decisão do autor.
13. **Dados de exemplo sintéticos seguem sendo a base** e o aviso "não é aconselhamento nutricional" permanece. — Fonte: ADR-009, CR-04.

## Regras Críticas do Projeto

## CR-01 — O core não conhece domínio
O código em `core/`, `providers/`, `retrieval/`, `quality/` e `ops/` só depende de contratos (ports) e tipos genéricos.
Proibido: nomes, constantes, schemas, prompts, dados ou regras de qualquer domínio específico no core.
Todo conhecimento de domínio vive em um domain pack.
- **Como verificar:** busca por termos de domínio no core na revisão; um pack de exemplo roda sem alterar o core.
- **Fundamento:** ADR-001.

## CR-02 — A política fica no pack
Regras críticas de segurança e política (restrição de idade, moderação de conteúdo, privacidade, não aconselhar, limites
legais) **nunca** são implementadas no core. O kit expõe apenas o ponto de encaixe (`Guardrail`); a regra, a configuração e
os testes dela pertencem ao pack. O kit não afirma nem garante conformidade legal.
- **Como verificar:** nenhuma regra de política no core; todo guardrail de exemplo está em `examples/`.
- **Fundamento:** ADR-002.

## CR-03 — Saída sempre validada por schema
Nenhum resultado de LLM é devolvido ao chamador sem passar pelo schema (Zod) do pack. É proibido extrair JSON por regex ou
parse ad hoc. Falha de schema resulta em retry controlado e, esgotadas as tentativas, em resultado `invalid` explícito —
nunca em dado parcial ou não validado.
- **Como verificar:** testes de contrato do pipeline com saídas malformadas; ausência de regex de extração no código.
- **Fundamento:** ADR-003, ADR-006.

## CR-04 — Dados só com licença verificada; sem segredos no repositório
Datasets, corpora e exemplos de terceiros só entram no repo ou em packs distribuídos com licença conferida e atribuição
registrada. Chaves de API, tokens e credenciais ficam apenas em variáveis de ambiente; nunca em código, fixtures, logs ou
traces. Tracing não registra prompts/respostas com dados pessoais sem política explícita do pack.
- **Como verificar:** checklist de PR (licença/atribuição); varredura de segredos local antes de commit; `.env` no `.gitignore`.
- **Fundamento:** ADR-009.

### Regras de apoio (não numeradas como críticas)
- Mudança em contrato de port (`Provider`, `Embeddings`, `VectorStore`, `Guardrail`) exige ADR novo ou emenda.
- Código novo no core tem teste unitário; adaptadores seguem testes de contrato compartilhados.
- Documentação e comentários em pt-BR; nomes de código e README público em inglês [a confirmar — ver ARCHITECTURE_CHALLENGES].

## Dependências Externas
- **Serviços:** Postgres com extensão pgvector, subido localmente por Docker Compose (imagem `pgvector/pgvector`; tag confirmada na implementação); Ollama (`Embeddings`) para a reindexação.
- **Variáveis de ambiente (apenas nomes; valores nunca versionados):**
  - `DATABASE_URL` — connection string `postgres://usuario:senha@host:porta/banco` da fonte da verdade.
  - `PGVECTOR_URL` — connection string do índice vetorial (já existe; pode ser igual a `DATABASE_URL`).
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — só para o Docker Compose (senha obrigatória, sem padrão); `POSTGRES_PORT` opcional (padrão 5432).
  - `PACK_DATA_DIR` — pasta local da TACO (já existe; opcional).
  - `OLLAMA_HOST`, `OLLAMA_EMBED_MODEL` — para gerar embeddings na reindexação (já existem).
- **Ferramentas:** Docker (Compose v2), Node ≥ 22, pnpm.
- **Bibliotecas novas (apenas desenvolvimento; versões conferidas no `pnpm view` na instalação):** `drizzle-orm`, `drizzle-kit`, `pg` (+ `@types/pg`), `tsx` (executar scripts TypeScript).
- **Arquivos externos:** dataset TACO em `data/taco/` (ignorado pelo git), opcional.
- **Pré-requisito de outro epic:** `createPgVectorStore`, `indexKnowledge` e `Embeddings` Ollama (epic-001, passos 3 e 5) precisam estar implementados antes das etapas de reindexação deste epic; as etapas de schema/seed/loader são independentes.
- **Rastreamento (Linear):** não configurado (rastreamento manual, como nos epics 001 e 002). Limitação registrada.

## Emendas
- **2026-11-25 — schema e seed sintético (escopo ampliado a pedido do autor).** Entregues: `schema.ts` (5 tabelas), `drizzle.config.ts`, migration `0000_tabelas_iniciais`, `migrate.ts`, `seed-data.ts` (estruturado, idêntico ao `data.ts`), `seed.ts` (idempotente, em transação) e scripts `db:generate`/`db:migrate`/`db:seed`. Verificado num Postgres descartável (migrate e seed duas vezes, FK, cascade). Critérios 2 e 3 cobertos. **Continuam com o autor:** mappers, `loadPackDataFromDb`, `createNutritionPack(data?)`, carga TACO, reindex e testes. Atenção ao calcular calorias: o `round` do Postgres em `double precision` arredonda 334,5 para 334; `data.ts` declara 335 (`Math.round`). Calcule em JS com `Math.round`.
- **2026-11-25 — execução restrita à conexão.** O autor pediu que o Execution cubra **somente a conexão com o banco**; schema, migrations, seed, mappers, repository, `pack.ts`/`run.ts`, reindex e testes de RAG ficam para o autor, manualmente. Entregue: ADR-011 (+ `adrs-summary`, `tech-stack`), dependências de desenvolvimento (`drizzle-orm`, `pg`, `@types/pg`, `tsx`; `drizzle-kit` fica para o schema), `docker-compose.yml`, `client.ts` (`createDb`), `ping.ts`, scripts `db:up`/`db:down`/`db:ping` e nomes de variáveis no `.env.example`. Verificado com um Postgres descartável (conexão OK, pgvector 0.8.7 disponível, erros sem vazar a URL). Critério de aceite 1 coberto; 2 a 10 pendentes.
- **2026-11-25 — criação.** Escolhas do autor: Docker Compose no repo; Drizzle como camada de acesso; índice no mesmo Postgres em tabela separada; sintético como base e TACO complementar; reindexação completa sem mudar o port.
