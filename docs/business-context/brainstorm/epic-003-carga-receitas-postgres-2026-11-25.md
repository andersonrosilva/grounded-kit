# Brainstorm — epic-003-carga-receitas-postgres (2026-11-25)

> Pedido do autor: carregar as receitas **fora do teste**, a partir de um **Postgres**, "o mais real possível, para
> aprendizado". Hoje o pack lê `examples/nutrition-pack/data.ts` (fixture em memória). Este documento registra as
> alternativas avaliadas; as escolhas do autor estão marcadas com **(escolhida)**.

## Camadas do problema

```
fonte da verdade (Postgres)  ──►  loader/adaptador no pack (SELECT → KnowledgeItem[] + tabela)  ──►  índice vetorial (pgvector)
```

O pgvector guarda só uma **cópia derivada** (vetores + payload). Quem manda no dado é o Postgres relacional.

## Decisões e alternativas

### A. Onde mora a fonte da verdade das receitas
1. **Postgres relacional (escolhida)** — receitas, ingredientes, alimentos e alérgenos normalizados. Mais próximo de um sistema real; ensina modelagem, FK, migrations, seed.
2. Arquivos JSON/CSV versionados — simples, mas não ensina nada de banco e não tem integridade referencial.
3. SQLite — banco real sem servidor, porém foge do Postgres que o autor já usa para o pgvector.

### B. Como o código fala com o banco
1. **Drizzle ORM + drizzle-kit (escolhida pelo autor)** — schema em TypeScript, tipos inferidos, migrations SQL geradas e versionadas, sem etapa de codegen; combina com ESM/tsup e com a validação Zod do projeto. Docs conferidas no Context7 (`/drizzle-team/drizzle-orm-docs`): coluna `vector`, índice HNSW, `onConflictDoUpdate`, `migrate()` com `node-postgres`.
2. Migrations `.sql` puras + `pg` — máximo contato com SQL, zero ORM (recomendada na pergunta, não escolhida).
3. Prisma — ótimo DX, mas exige `prisma generate` e um engine próprio; mais peso para um pacote pequeno.

### C. Onde fica o índice vetorial
1. **Mesmo Postgres, tabela separada (escolhida)** — uma conexão, mas tabelas distintas; o índice é derivado e reconstruível.
2. Banco/instância separado — mais fiel a um vector DB dedicado, porém duas URLs e mais setup.
3. Colocar o vetor na própria tabela `recipes` — mistura dado e derivado; trocar de modelo de embeddings exigiria migration. Descartada.

### D. Receita apagada no banco continua no índice? (port `VectorStore` só tem `upsert`/`query`)
1. **Reindexação por sincronização (escolhida)** — reconstrução completa do índice do pack a partir do banco; não toca o port nem exige ADR no contrato. Follow-up: `delete(ids)` incremental via emenda de ADR.
2. Adicionar `delete(ids)` ao port — correto para sistema real, mas muda contrato e atinge o epic-001.
3. Soft-delete (flag `active`) filtrado na consulta — o pipeline precisaria conhecer o filtro; vaza detalhe do banco para o core.

### E. TACO × dados sintéticos (nomes diferentes)
1. **Sintético como base, TACO complementa por chave (escolhida)** — a carga TACO só adiciona chaves novas; em conflito, vale o sintético (mantém as receitas e os testes determinísticos).
2. TACO sobrescreve o sintético — mudaria as calorias das receitas.
3. Alinhar os nomes das receitas aos da TACO — trabalho de curadoria fora do escopo; fica como follow-up (tabela de aliases).

### F. Como subir o Postgres local
1. **`docker-compose.yml` no repo, imagem com pgvector (escolhida)** — reproduzível; senha só por variável de ambiente (CR-04).
2. Postgres instalado na máquina — sem arquivo no repo, menos reproduzível.
3. Serviço gerenciado (Neon/Supabase) — depende de conta e rede.

## Riscos levantados

- Docker e "banco real na suíte" estavam **fora** do stack do MVP (`tech-stack.md`, ADR-010): exige um ADR novo (ADR-011) que delimite Docker/Drizzle ao pack de exemplo e à integração opt-in.
- `drizzle-orm`/`drizzle-kit`/`pg`/`tsx` são dependências novas de desenvolvimento (versões conferidas na instalação, não de memória).
- A fonte do índice (epic-001, `createPgVectorStore`) e o `Embeddings` Ollama ainda são esqueleto: a etapa de reindexação depende deles.
- TACO é carga **local**; o banco com dados TACO não é distribuído (ressalva de licença em `docs/DATA_SOURCES.md`).
