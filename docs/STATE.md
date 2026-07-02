---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-07-02 por @dev (E00-S05 + E00-S06 mergeadas e **deployadas em produção** — Auth real + RBAC funcionando de ponta a ponta no Supabase novo)

## Status geral
**Fase:** Casca concluída (E00-S04) + E00-S05 (Autenticação e Autorização) + E00-S06 (sync Padrão OS)
mergeadas em `main` **e aplicadas em produção**. Repo `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`.
Supabase **reprovisionado** em 2026-07-02 (`nudannsrfvjggoergvyn`) — schemas, migrations, GRANTs,
Custom Access Token Hook e Data API expostos, todos confirmados via query direta/Management API.
**Gates (main):** audit-esteira ✅ · eval:spec ✅ · typecheck ✅ · lint ✅ · test ✅ · arch:check ✅ ·
`db-tests` (pgTAP via Docker no CI) ✅ · `audit:deps` ✅ (vite HIGH corrigido, ver Decisões)

## Em andamento / próximo passo
- **PR #4 (E00-S05) e PR #5 (E00-S06) mergeados em `main`, produção confirmada funcional.**
  Passaram pela pipeline real pela primeira vez nesta sessão — 10 bugs reais foram achados e
  corrigidos só rodando o CI/produção de verdade (não por inspeção): `pnpm/action-setup` rejeitava
  versão duplicada, `dependency-cruiser` exige Node ≥22, `gitleaks` achou falso positivo em doc
  vendorizada, `vite` tinha vuln HIGH, a migration 0002 não tinha `GRANT` de base (RLS nunca teria
  funcionado em produção sem isso), teste pgTAP com premissa errada, hook de Auth e schemas
  expostos não registrados no projeto hospedado (fechados via Management API). Ver Decisões.
- **Ainda manual (não coberto por CI/API):** login no browser para validar AC-1,2,4-7 fim a fim.
- **Ainda pendente:** rotacionar o JWT secret legado do projeto (exposto sem querer num diagnóstico
  desta sessão) — ver Bloqueios.
- **Próximo passo de feature:** E01-S09 — PCM telas de operação com dados reais (agora que há RLS
  e sessão real); ou `specs/0002` (abertura de chamado via Zé).
- **Branches anteriores ainda pendentes de PR:** `docs/E01-S03-pmoc-spec` (PMOC spec + rename
  OS→SO + design system).

## Specs implementadas / artefatos prontos
| Spec | Status | Gate |
|------|--------|------|
| `0001-priorizacao-backlog-gut` | implementado, todos os ACs verdes | pnpm test |
| `0002-abertura-chamado-ze` | aprovado (aguarda implementação — Mês 2) | — |
| `E00-S03-dashboard-geral` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S04-sidebar-logo` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S05-autenticacao-autorizacao` | **implementado**, todos os ACs verdes (`db-tests` no CI) | typecheck ✅ · lint ✅ · test ✅ · `supabase test db` ✅ (29/29, via CI/Docker) |
| `E00-S06-sync-padrao-os-v3` | implementado, todos os ACs verdes | audit-esteira ✅ · eval:spec ✅ · typecheck ✅ · lint ✅ · test ✅ · arch:check ✅ |
| `specs/E01-S03-pmoc-schema/design.md` | design arquitetural criado (tier arquitetural) | revisão humana |

## Decisões recentes
- 2026-07-02: Custom Access Token Hook e schemas expostos (`pcm`/`atendimento`/`comercial`/
  `config`) registrados no projeto **hospedado** via Management API (`PATCH config/auth` e
  `PATCH postgrest`), não pelo Dashboard manualmente — mais rápido e auditável no histórico da
  conversa; confirmado por leitura de volta da config após aplicar.
- 2026-07-02: migration `0002_E00-S05_perfis_rbac.sql` não tinha `GRANT USAGE`/`SELECT`/`INSERT`/
  `UPDATE` para `authenticated` nos schemas de domínio — as RLS policies existiam mas o Postgres
  nega no nível de privilégio *antes* de avaliar RLS. Só apareceu rodando `supabase test db` de
  verdade (job `db-tests`, CI) — teria quebrado em produção do mesmo jeito. Grant adicionado à
  própria migration (ainda não aplicada a nenhum ambiente real).
- 2026-07-02: pgTAP não lança `42501` numa `UPDATE` filtrada pela `USING` da RLS — só em `INSERT`
  (violação de `WITH CHECK`). Teste corrigido para comparar valor antes/depois em vez de
  `throws_ok`.
- 2026-07-02: CI em Node 20 não roda `dependency-cruiser` 18 (exige `^22||^24||>=26`) — CI e
  `engines` do `package.json` raiz bumpados para Node ≥22.
- 2026-07-02: `vite` (via `@tailwindcss/vite`) tinha vuln HIGH (`GHSA-fx2h-pf6j-xcff`, sem patch na
  linha 5.x) — bump coordenado vite 6.4.3 + vitest 3.2.6 + `@vitejs/plugin-react` 4.7.0.
- 2026-07-02: `pnpm/action-setup@v4` recusa `with: version` quando o `package.json` já fixa
  `packageManager` — removido do `ci.yml` (só apareceu no 1º CI run real deste repo).
- 2026-07-02: `arch:check` (dependency-cruiser) roda sobre `apps/web/src` com `tsConfig.fileName`
  **absoluto** (`require("node:path").join(__dirname, ...)`) — passar caminho relativo causa bug
  de resolução do `extends` do `tsconfig.json` em monorepo (dependency-cruiser 18.0.0).
- 2026-07-02: RBAC via claim `user_role` no JWT (Custom Access Token Hook) + tabela `config.usuarios`, não subquery por policy — [ADR-0003](adr/0003-rbac-jwt-claim-config-usuarios.md).
- 2026-07-02: Provisionamento de usuário é manual em 2 passos (sem trigger automático em `auth.users` — não há como inferir o papel correto) — ver `runbooks/provisionar-usuario.md`.
- 2026-07-01: Renomeação produto "Sinérgica OS" → "Sinérgica SO" para eliminar ambiguidade com OS (Ordem de Serviço). "OS" = Ordem de Serviço; "SO" = Sistema Operacional.
- 2026-07-01: Tabelas PMOC (`pmoc_*`) vivem no schema `pcm` — PMOC é sub-módulo do PCM, não contexto autônomo.
- 2026-07-01: Checklists PMOC canônicos são constantes TypeScript em `packages/shared` (não no banco).
- 2026-07-01: OS Hub (E01-S07) decisão postergada — nova tabela vs refatoração da OS existente → design.md de E01-S07.
- 2026-06-25: PCM como origin of truth; Auvo recebe `externalId` idempotente — [ADR-0001](adr/0001-pcm-origin-truth-externalid.md)
- 2026-06-25: Detecção determinística de menção ao Zé antes de chamar o LLM — [ADR-0002](adr/0002-deteccao-deterministica-ze.md)
- 2026-06-25: Monorepo app único (`apps/web`) com features por bounded context — sem apps separados

## Bloqueios
- [x] ~~Git push bloqueado~~ ✅ Resolvido — novo repo `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`, Lucas é owner.
- [x] ~~Supabase não provisionado~~ ✅ Resolvido, depois **reprovisionado** — projeto atual:
      `nudannsrfvjggoergvyn.supabase.co`. `.env.local` atualizado (URL, publishable key,
      service_role, `SUPABASE_DB_PASSWORD`) — todos do projeto novo.
- [x] ~~E00-S05 precisa de Docker local~~ ✅ Resolvido — job `db-tests` no CI roda `supabase start`
      + `supabase test db` via Docker do runner do GitHub Actions. Achou e permitiu corrigir o bug
      real do GRANT ausente (ver Decisões). 29/29 pgTAP verdes.
- [x] ~~Migrations não aplicadas no projeto novo hospedado~~ ✅ Resolvido — GitHub Integration
      nativa ativada por Lucas (Settings → Integrations → GitHub, "Deploy to production" ON,
      production branch = `main`); aplicou `0001`+`0002` automaticamente. Confirmado por query
      direta em `supabase_migrations.schema_migrations` + existência dos 10 schemas + GRANTs
      corretos em `pcm.*` para `authenticated`.
- [x] ~~Ativar GitHub Integration nativa~~ ✅ Resolvido (mesmo item acima).
- [x] ~~Registro do Custom Access Token Hook em produção~~ ✅ Resolvido via Management API
      (`PATCH /v1/projects/{ref}/config/auth`) — `hook_custom_access_token_enabled: true`,
      apontando para `config.custom_access_token_hook`. Sem isso o JWT não carregava
      `user_role` e toda RLS negaria por padrão (AC-9) mesmo com login funcionando.
- [x] ~~Exposição dos schemas de domínio na Data API em produção~~ ✅ Resolvido via Management API
      (`PATCH /v1/projects/{ref}/postgrest`) — `db_schema` passou de `public,graphql_public` para
      incluir `pcm,atendimento,comercial,config`, espelhando `supabase/config.toml` local.
- [ ] **Rotacionar o JWT secret legado do projeto** — exposto sem querer no output de um comando
      de diagnóstico durante esta sessão (Dashboard → Settings → API → JWT Settings). Não é
      catastrófico (Supabase migrando desse esquema legado), mas é boa prática rotacionar algo que
      apareceu em texto puro numa conversa. Quem destrava: @devops/Lucas.
- [ ] Evolution API: instância existe na Cloudfy mas webhook não apontado para Supabase Edge Function ainda. Quem destrava: @devops/Lucas.

## Ideias adiadas / backlog técnico
- Evals de laudo SPDA (comparação de saída LLM com laudos validados por engenheiro) → gatilho: primeira geração de laudo em produção
- Repriorização por IA no backlog GUT → gatilho: 3 meses de histórico de priorização
- Modo de Zé por número de técnico (DM direto) → gatilho: pedido explícito da Sinérgica

## Todos soltos
- [ ] Configurar CODEOWNERS (`.github/CODEOWNERS`) quando o time de desenvolvimento estiver definido
- [ ] Atualizar `docs/ENVIRONMENTS.md` quando URLs reais de staging/produção existirem
- [ ] Executar `pnpm run audit:deps` após provisionar e instalar dependências reais em CI
