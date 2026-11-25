# Architecture: epic-003-carga-receitas-postgres — Carga das receitas a partir de um Postgres real

## Visão Geral

**Antes:** `createNutritionPack()` importa `data.ts` (6 receitas e 18 alimentos em memória). O índice é in-memory.

**Depois:** três camadas, todas no pack de exemplo; o core e os ports não mudam.

```
 CAMADA 1 — fonte da verdade (Postgres, DATABASE_URL)                     [escrita: seed / carga TACO]
   allergens ◄── food_allergens ──► foods ◄── recipe_ingredients ──► recipes
        ▲                              ▲
        │ seed sintético (idempotente) │ carga TACO: só chaves novas (sintético prevalece)
        │                              │
 CAMADA 2 — loader/adaptador no pack                                      [leitura]
   repository.loadPackDataFromDb(db)  = SELECTs
        └─► mappers (puros, sem banco): rows → KnowledgeItem[] + tabela alimento→fatos
                                      │
                                      ▼  PackData { items, table }
   createNutritionPack(data?)  ← injeção (padrão: data.ts)
                                      │
 CAMADA 3 — índice vetorial (derivado, PGVECTOR_URL; mesma instância, tabela separada)
   rebuildIndex({ data, embeddings, client })
        = recria a tabela do índice → ensureSchema() → indexKnowledge(pack, …) → upsert por id estável
                                      │
                                      ▼
   pipeline.run(pack, input)   (inalterado: retrieve → generate → validate → moderate)
```

Fluxo operacional (um comando por etapa, cada um falha alto se faltar variável):

```
pnpm db:up        # Compose: Postgres + pgvector (variáveis POSTGRES_*)
pnpm db:generate  # drizzle-kit: schema.ts → migrations/*.sql   (só quando o schema muda)
pnpm db:migrate   # aplica migrations pendentes
pnpm db:seed      # sintéticos (+ --taco para complementar com a TACO)
pnpm db:reindex   # banco → embeddings (Ollama) → índice pgvector
```

### Modelo de dados (Postgres, Drizzle em `db/schema.ts`)

| Tabela | Colunas principais | Observações |
|---|---|---|
| `allergens` | `code` (PK, texto) | Vocabulário fechado: gluten, leite, ovo, amendoim, peixe. |
| `foods` | `key` (PK, normalizada), `name`, `kcal_per_100g` (numérico), `source` (`synthetic` \| `taco`) | `key` segue a convenção de `data.ts`. |
| `food_allergens` | `food_key` FK→`foods`, `allergen_code` FK→`allergens`; PK composta | Mapa alimento→alérgeno. |
| `recipes` | `id` (PK, texto estável), `title`, `instructions` (texto), `servings`, `updated_at` | `id` = `KnowledgeItem.id`. Sem coluna de calorias. |
| `recipe_ingredients` | `recipe_id` FK→`recipes` (cascata), `position`, `food_key` FK→`foods`, `grams`; PK (`recipe_id`, `position`) | Calorias = Σ gramas × kcal/100 g. |

Índice vetorial: tabela **própria do adaptador** `createPgVectorStore` (epic-001), criada por `ensureSchema()`; **não** é declarada no schema Drizzle, para não haver dois donos da mesma tabela.

### Decisões de design deste epic
- **Texto embedado derivado da estrutura:** `buildRecipeText(recipe, ingredients)` monta `KnowledgeItem.text` (título + ingredientes com gramas + preparo + calorias) e `metadata` (`title`, `calories`). Como `data.ts` guarda o texto pronto e o seed guarda a estrutura, um **teste de consistência** compara os dois caminhos (ids, títulos, calorias, conjunto de ingredientes).
- **Mapeadores puros** (`mappers.ts`) separados dos SELECTs (`repository.ts`): a regra de negócio fica testável sem banco; o SELECT fica fino.
- **Reindexação por reconstrução completa:** `rebuildIndex` descarta a tabela do índice e a recria. Resolve "receita apagada continua no índice" sem `delete` no port. A operação toca só a tabela derivada, com nome validado (identificador seguro) e por parâmetros onde o SQL permitir.
- **Injeção de dados:** `PackData = { items: KnowledgeItem[]; table: Readonly<Record<string, NutritionFact>> }`; `createNutritionPack(data = defaultPackData())`. O alerta de ≈100 linhas do pack (ADR-005) não muda: só a origem dos dados.
- **Conexão:** `createDb(env)` recebe o `env` por parâmetro (testável, como `resolveDatasetDir`), valida `DATABASE_URL` e devolve `{ db, close }`; uma única conexão/pool por execução; sem log da URL.
- **Isolamento dos testes de integração:** schema temporário (`CREATE SCHEMA` com sufixo aleatório, `search_path` ajustado, `DROP SCHEMA … CASCADE` no `afterAll`).

## Estrutura de Arquivos

### Criar — `examples/nutrition-pack/db/` (assinaturas + comentários de treino; autor implementa)
- `docker-compose.yml` — serviço Postgres com pgvector; `POSTGRES_USER/PASSWORD/DB` com `${VAR:?mensagem}` (sem padrão para a senha); volume nomeado; porta `${POSTGRES_PORT:-5432}`.
- `drizzle.config.ts` — `defineConfig` (`dialect: "postgresql"`, `schema`, `out: "./migrations"`, `dbCredentials.url` de `DATABASE_URL`).
- `schema.ts` — as 5 tabelas acima com `pgTable`.
- `migrations/` — SQL gerado por `drizzle-kit generate` (versionado).
- `client.ts` — `createDb(env)` (Drizzle sobre `pg`); `runMigrations(db)`.
- `seed-data.ts` — receitas, alimentos e alérgenos sintéticos **estruturados** (mesmo conteúdo de `data.ts`).
- `seed.ts` — `seedSynthetic(db)`, `seedTaco(db, dir)` (usa `loadNutritionTableFromDataset`; `onConflictDoNothing` por `key`), `main` (flag `--taco`).
- `mappers.ts` — `normalizeFoodKey`, `buildRecipeText`, `toKnowledgeItems`, `toNutritionTable` (puros).
- `repository.ts` — `loadPackDataFromDb(db): Promise<PackData>` (SELECTs com junções).
- `reindex.ts` — `rebuildIndex({ data, embeddings, client, table? })` e `main` (monta Ollama + `createPgVectorStore`).
- `README.md` — passo a passo e o diagrama das 3 camadas; aviso "não é aconselhamento nutricional".

### Criar — `tests/examples/` (`it.todo`; integração com `describe.skipIf`)
- `db-mappers.test.ts` — `normalizeFoodKey`, `buildRecipeText`, calorias derivadas, `toNutritionTable` (linhas simuladas, sem banco).
- `seed-consistency.test.ts` — itens vindos de `seed-data.ts` × `getKnowledgeItems()`/`getNutritionTable()`.
- `pack-data-injection.test.ts` — `createNutritionPack(data)` usa os dados injetados; sem argumento usa `data.ts`.
- `reindex.test.ts` — `rebuildIndex` com `Embeddings` falso e `client` falso: sequência de comandos, contagem, idempotência.
- `db.integration.test.ts` — migrate + seed + `loadPackDataFromDb` + reindex reais em schema temporário (`skipIf(!DATABASE_URL)`).

### Modificar
- `examples/nutrition-pack/pack.ts` — exportar `PackData`; `createNutritionPack(data?)`.
- `examples/nutrition-pack/run.ts` — escolher a fonte: banco se `DATABASE_URL`, senão `data.ts`; documentar no comentário de treino.
- `examples/nutrition-pack/README.md` — corrigir "você escreve os dados" (desatualizado) e apontar para `db/README.md`.
- `package.json` — devDependencies `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `tsx`; scripts `db:up`, `db:down`, `db:generate`, `db:migrate`, `db:seed`, `db:reindex`.
- `.env.example` — acrescentar `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` (só nomes).
- `docs/technical-context/adr/ADR-011-camada-de-dados-do-pack-postgres.md` — novo ADR (ver abaixo).
- `docs/technical-context/briefing/adrs-summary.md` — incluir ADR-011 (adr_count passa a 11).
- `docs/technical-context/briefing/tech-stack.md` — Docker/Compose e Drizzle delimitados ao pack e à integração opt-in; `pg` já não é só peer.
- `docs/DATA_SOURCES.md` — fonte 2: a TACO também é carregada em Postgres **local**, não distribuído.
- `docs/technical-context/ARCHITECTURE_CHALLENGES.md` — registrar os follow-ups (delete no port, aliases TACO, blue/green).

### Não tocar
- `src/**` (incluindo `src/retrieval/pgvector/index.ts` e o port `VectorStore`), `.env`, `examples/playground/`.

## ADRs Aplicáveis
- **ADR-001 — Motor × domínio (CR-01):** schema, tabelas e SELECTs vivem em `examples/`; `src/` não importa Drizzle nem conhece `foods`/`recipes`. O teste de arquitetura existente continua válido.
- **ADR-002 — Política no pack (CR-02):** o dado de alérgenos mora no banco; a regra de bloquear continua no guardrail de `pack.ts`.
- **ADR-003 — Zod como fonte de verdade de schema:** linhas lidas da TACO e do banco passam por validação Zod nas bordas (linha inválida → `skipped`/erro explícito, nunca dado meio válido).
- **ADR-004 — Pacote único com subpath exports:** nenhum subpath novo; `drizzle-*`, `pg` e `tsx` são só de desenvolvimento e não entram em `dist/`; `pg` continua peer opcional do subpath pgvector.
- **ADR-005 — Pack declarativo:** `createNutritionPack(data?)` continua pequeno; só a origem dos dados é injetada.
- **ADR-008 — Providers/embeddings via port:** a reindexação usa o port `Embeddings` (Ollama), sem acoplar a um modelo.
- **ADR-009 — Licenças de dados e segredos (CR-04):** credenciais só por ambiente; Compose sem senha padrão; TACO só local; atribuição mantida em `DATA_SOURCES.md`.
- **ADR-010 — Toolchain e testes do MVP:** a suíte padrão segue sem banco e sem rede; integração opt-in (emenda 2026-11-25). **Conflito tratado abaixo.**
- **ADR-011 — a criar neste epic:** "Camada de dados do pack de exemplo: Postgres como fonte da verdade, Drizzle e Docker Compose opt-in". Define: escopo restrito a `examples/` e à integração opt-in; versões fixadas na instalação; migrations imutáveis; `tsx` para scripts; reindexação completa em vez de `delete` no port.

### CONFLITO DETECTADO
Requisito: subir Postgres por Docker Compose e usar um ORM no pack de exemplo.
Conflita com: ADR-010 / `tech-stack.md` — "Fora do stack no MVP: Docker/Testcontainers … banco de dados real na suíte padrão".
Resolução (escolhida pelo autor em 2026-11-25, opção B): novo **ADR-011** delimita Docker, Drizzle e o banco real ao pack de exemplo e à integração opt-in; a suíte padrão continua sem banco e sem rede, então o espírito do ADR-010 é preservado. Sem mudança em contrato de port (regra de apoio respeitada).

## Dependências Externas
- **Variáveis de ambiente:** `DATABASE_URL` (`postgres://usuario:senha@host:porta/banco`), `PGVECTOR_URL` (mesmo formato; pode ser igual à anterior), `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` (texto; só Compose; senha obrigatória), `POSTGRES_PORT` (inteiro, opcional, padrão 5432), `PACK_DATA_DIR` (caminho, opcional; ex.: `./data/taco`), `OLLAMA_HOST` (URL) e `OLLAMA_EMBED_MODEL` (texto). Valores nunca versionados; `.env` não é lido nem alterado por este epic.
- **Serviços:** Postgres + pgvector em container local (porta `POSTGRES_PORT`, padrão `localhost:5432`); Ollama em `OLLAMA_HOST` (`/api/embed`, confirmado na implementação do epic-001).
- **Arquivos:** `data/taco/taco-db-nutrientes.csv` (opcional, ignorado pelo git); `examples/nutrition-pack/db/migrations/*.sql` (gerados e versionados).
- **Bibliotecas (dev):** `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `tsx`. Versões decididas com `pnpm view` na instalação (não de memória). Referências conferidas no Context7 (`/drizzle-team/drizzle-orm-docs`): coluna/índice `vector`, `onConflictDoUpdate`/`onConflictDoNothing`, `migrate()` de `drizzle-orm/node-postgres/migrator`, `drizzle-kit generate`/`migrate`.
- **Ferramentas:** Docker com Compose v2; pnpm; Node ≥ 22.
- **Dependência de outro epic:** `createPgVectorStore`, `indexKnowledge` e o `Embeddings` Ollama (epic-001) para os passos 5–6.

## Trade-offs e Alternativas
1. **Drizzle × SQL puro × Prisma.** Escolhido (autor): Drizzle. Ganha tipos inferidos do schema, migrations geradas e sem etapa de codegen. Custo: três dependências novas e SQL menos visível; mitigado por ler o `migration.sql` gerado a cada mudança. SQL puro (mais didático em SQL) e Prisma (engine próprio) ficaram de fora.
2. **Reindexação completa × `delete(ids)` no port × soft-delete.** Escolhido: completa. Ganha: nenhuma mudança de contrato, estado final sempre igual ao banco. Custo: re-embeda tudo (uma chamada por lote) e a tabela fica indisponível durante a reconstrução. Mitigação futura: construir em tabela `_next` e trocar por rename (blue/green) ou emenda de ADR para `delete`. Para ~6–500 receitas o custo é aceitável.
3. **Índice no mesmo Postgres × separado.** Escolhido: mesmo servidor, tabela separada. Ganha uma só infraestrutura e transação local possível; custo: o vetor compartilha recursos com o dado transacional (irrelevante nesta escala).
4. **Sintético prevalece × TACO sobrescreve.** Escolhido: sintético prevalece. Ganha receitas/testes determinísticos; custo: valores TACO de alimentos de mesma chave são ignorados, e nomes diferentes (`arroz branco cozido` × `Arroz, tipo 1, cozido`) coexistem sem vínculo até haver tabela de aliases (follow-up).
5. **Calorias derivadas × coluna `calories`.** Escolhido: derivadas. Ganha uma só fonte da verdade; custo: junção/soma a cada leitura (trivial aqui) e dependência de `kcal_per_100g` completo.
6. **Seed estruturado + teste de consistência × transformar `data.ts` na origem única.** Escolhido: manter `data.ts` como fixture dos testes e criar `seed-data.ts` estruturado, com teste que compara os dois. Custo: dados duplicados (mitigado pelo teste); ganho: `data.ts` e os testes existentes ficam intactos.
7. **Docker Compose no pack (`db/`) × na raiz.** Escolhido: dentro de `examples/nutrition-pack/db/`, invocado por `pnpm db:up` com `--env-file .env`, para manter o artefato de infraestrutura junto do pack e fora do pacote do kit.

## Sequência de Implementação Sugerida
1. ADR-011 + docs (`tech-stack`, `adrs-summary`, `DATA_SOURCES`, `.env.example`) + dependências e scripts no `package.json`.
2. `docker-compose.yml` e `db:up` (variáveis obrigatórias; subir e conectar com `psql`).
3. `schema.ts`, `drizzle.config.ts`, `client.ts`, primeira migration (`db:generate` → `db:migrate`).
4. `mappers.ts` + `seed-data.ts` + `seed.ts` com testes unitários (`db-mappers`, `seed-consistency`) — sem banco.
5. `repository.ts` (SELECTs) + teste de integração opt-in; carga TACO (`--taco`).
6. `createNutritionPack(data?)` + `run.ts` (fonte por variável) + teste de injeção.
7. `rebuildIndex` + `reindex.test.ts` (fakes) e integração do reindex (depende do epic-001, passos 3 e 5).
8. READMEs, varredura de segredos, `typecheck`/`eslint`/`prettier`, `pnpm test` sem banco.

## Verificação de Consistência
Assinado em 2026-11-25 (Strategy, perfil techlead): `context.md` e `architecture.md` foram comparados item a item.
- Critérios de aceite → arquivos: 1 → `docker-compose.yml`, `package.json` (`db:up`), `.env.example`; 2 → `schema.ts`, `drizzle.config.ts`, `migrations/`, `client.ts`; 3 → `seed-data.ts`, `seed.ts`; 4 → `seed.ts` (`seedTaco`), `load-dataset.ts` existente; 5 → `mappers.ts`, `repository.ts`, `seed-consistency.test.ts`; 6 → `pack.ts`, `pack-data-injection.test.ts`; 7 → `reindex.ts`, `reindex.test.ts`, `db.integration.test.ts`; 8 → `describe.skipIf`, schema temporário, `db.integration.test.ts`; 9 → "Não tocar `src/**`" e teste de arquitetura existente; 10 → `.env.example`, varredura de segredos no passo 8.
- Regras de negócio 1–13 têm responsável: 1, 4 e 12 → camadas 1–3 e `reindex.ts`; 2 → `client.ts`, Compose, `.env.example`; 3 → testes `skipIf`; 5–7 → `mappers.ts` + `schema.ts`; 8 → `schema.ts` (tabelas) + `pack.ts` (guardrail); 9 e 10 → `seed.ts`; 11 → `drizzle.config.ts`, ADR-011; 13 → `seed-data.ts`, READMEs.
- Escopo "Excluído" não tem arquivo em "Criar" (sem alteração em `src/`, sem `delete` no port, sem CI/Testcontainers, sem aliases TACO, sem blue/green). O item "Docker" que o `tech-stack.md` excluía do MVP é tratado pelo ADR-011.
- Dependências de `context.md` (variáveis, serviços, ferramentas, bibliotecas, pré-requisito do epic-001) estão idênticas nesta seção.
- ADRs 001–005, 008–010 mapeadas; ADR-011 a criar; **um conflito detectado e resolvido** (ADR-010 × Docker/ORM) via novo ADR; nenhuma regra crítica violada (CR-01 a CR-04 respeitadas).
