---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-07-02 por @dev (E00-S06 — sync Padrão OS v3/Triviaiox: agente morto, gate de arquitetura, CI/deploy)

## Status geral
**Fase:** Casca concluída — E00-S04 implementado. Repo migrado para `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO` (Lucas é owner). Supabase provisionado.
**Em paralelo (branches não mergeadas):** `feat/E00-S05-autenticacao-autorizacao` (Supabase Auth real + RBAC, aguardando validação com Docker) e `chore/E00-S06-sync-padrao-os-v3` (esta sessão — ver abaixo).
**Gates (main):** pnpm test ✅ · typecheck ✅ · lint ✅ · audit-esteira ✅ · eval-spec-fidelity ✅ · arch:check ✅ (novo, ver E00-S06)

## Em andamento / próximo passo
- **Branch atual:** `chore/E00-S06-sync-padrao-os-v3` — sincroniza correções identificadas no
  Padrão OS v3.0.0 (vault) e Triviaiox (commits `ad48746`/`e05d8d0` de 2026-07-01): agente morto
  `@github-devops` → `@devops` nos 6 wrappers Claude Code; gate `arch:check`
  (dependency-cruiser, adaptado a `apps/web/src/features/*/{domain,application,infrastructure}`);
  `gitleaks-action@v2` (exigia `GITLEAKS_LICENSE` em repo de organização, provável causa de CI
  não rodar) trocado pela CLI grátis; `.github/workflows/deploy.yml` novo (migrations + Edge
  Functions automatizadas no merge, staging/production). Ver `specs/E00-S06-sync-padrao-os-v3/`.
- **Pendência (AC-2, bloqueada):** hook `enforce-git-push-authority.sh` foi criado em
  `.claude/hooks/` mas **não está ativo** (sem `chmod +x`, sem merge no `.claude/settings.json`)
  — o classificador de auto-modo do Claude Code bloqueou essa escrita por ser self-modification de
  permissões, exige confirmação explícita e nomeada do usuário. Ver `tasks.md` da story
  (SPEC_DEVIATION documentada).
- **Pendência (deploy.yml):** só funciona depois que alguém com acesso ao GitHub configurar os
  environments `staging`/`production` e os secrets `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_ID`/
  `SUPABASE_DB_PASSWORD` — ver `docs/ENVIRONMENTS.md`.
- **Próximo passo de E00-S05:** alguém com Docker rodar `supabase start && supabase db reset &&
  supabase test db` + validar login manual antes do merge — checklist completo em
  `specs/E00-S05-autenticacao-autorizacao/tasks.md` (só existe na branch `feat/E00-S05-*`).
- **Próximo passo de feature (depois de E00-S05/E00-S06 mergeadas):** E01-S09 — PCM telas de
  operação com dados reais; ou `specs/0002` (abertura de chamado via Zé).

## Specs implementadas / artefatos prontos
| Spec | Status | Gate |
|------|--------|------|
| `0001-priorizacao-backlog-gut` | implementado, todos os ACs verdes | pnpm test |
| `0002-abertura-chamado-ze` | aprovado (aguarda implementação — Mês 2) | — |
| `E00-S03-dashboard-geral` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S04-sidebar-logo` | **implementado**, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S05-autenticacao-autorizacao` (branch própria) | código implementado, gates de banco pendentes de Docker | typecheck ✅ · lint ✅ · pnpm test ✅ |
| `E00-S06-sync-padrao-os-v3` | implementado — AC-1,3,4,5 verdes; AC-2 bloqueado (ver acima) | audit-esteira ✅ · eval:spec ✅ · typecheck ✅ · lint ✅ · test ✅ · arch:check ✅ |
| `specs/E01-S03-pmoc-schema/design.md` | design arquitetural criado (tier arquitetural) | revisão humana |

## Decisões recentes
- 2026-07-02: `arch:check` (dependency-cruiser) roda sobre `apps/web/src` com `tsConfig.fileName`
  **absoluto** (`require("node:path").join(__dirname, ...)`) — passar caminho relativo causa bug
  de resolução do `extends` do `tsconfig.json` em monorepo (dependency-cruiser 18.0.0).
- 2026-07-01: Renomeação produto "Sinérgica OS" → "Sinérgica SO" para eliminar ambiguidade com OS (Ordem de Serviço). "OS" = Ordem de Serviço; "SO" = Sistema Operacional.
- 2026-07-01: Tabelas PMOC (`pmoc_*`) vivem no schema `pcm` — PMOC é sub-módulo do PCM, não contexto autônomo.
- 2026-07-01: Checklists PMOC canônicos são constantes TypeScript em `packages/shared` (não no banco).
- 2026-07-01: OS Hub (E01-S07) decisão postergada — nova tabela vs refatoração da OS existente → design.md de E01-S07.
- 2026-06-25: PCM como origin of truth; Auvo recebe `externalId` idempotente — [ADR-0001](adr/0001-pcm-origin-truth-externalid.md)
- 2026-06-25: Detecção determinística de menção ao Zé antes de chamar o LLM — [ADR-0002](adr/0002-deteccao-deterministica-ze.md)
- 2026-06-25: Monorepo app único (`apps/web`) com features por bounded context — sem apps separados

## Bloqueios
- [x] ~~Git push bloqueado~~ ✅ Resolvido — novo repo `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`, Lucas é owner.
- [x] ~~Supabase não provisionado~~ ✅ Resolvido — `ljvpmcamqydeklvkiigy.supabase.co` · migration `0001` aplicada · `.env.local` configurado.
- [ ] Evolution API: instância existe na Cloudfy mas webhook não apontado para Supabase Edge Function ainda. Quem destrava: @devops/Lucas.

## Ideias adiadas / backlog técnico
- Evals de laudo SPDA (comparação de saída LLM com laudos validados por engenheiro) → gatilho: primeira geração de laudo em produção
- Repriorização por IA no backlog GUT → gatilho: 3 meses de histórico de priorização
- Modo de Zé por número de técnico (DM direto) → gatilho: pedido explícito da Sinérgica

## Todos soltos
- [ ] Configurar CODEOWNERS (`.github/CODEOWNERS`) quando o time de desenvolvimento estiver definido
- [ ] Atualizar `docs/ENVIRONMENTS.md` quando URLs reais de staging/produção existirem
- [ ] Executar `pnpm run audit:deps` após provisionar e instalar dependências reais em CI
