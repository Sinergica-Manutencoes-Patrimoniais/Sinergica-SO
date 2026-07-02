---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-07-02 por @dev (E00-S06 — sync Padrão OS v3.1.1: CD via GitHub Integration nativa, não Action; Supabase reprovisionado)

## Status geral
**Fase:** Casca concluída — E00-S04 implementado. Repo migrado para `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO` (Lucas é owner). Supabase **reprovisionado** em 2026-07-02 (projeto novo, ver Bloqueios).
**Em paralelo (branches não mergeadas):** `feat/E00-S05-autenticacao-autorizacao` (Supabase Auth real + RBAC, aguardando validação com Docker) e `chore/E00-S06-sync-padrao-os-v3` (esta sessão — ver abaixo).
**Gates (main):** pnpm test ✅ · typecheck ✅ · lint ✅ · audit-esteira ✅ · eval-spec-fidelity ✅ · arch:check ✅ (novo, ver E00-S06)

## Em andamento / próximo passo
- **Branch atual:** `chore/E00-S06-sync-padrao-os-v3` — sincroniza correções identificadas no
  Padrão OS v3.0.0→v3.1.1 (vault) e Triviaiox (commits `ad48746`/`e05d8d0` de 2026-07-01): agente
  morto `@github-devops` → `@devops` nos 6 wrappers Claude Code; gate `arch:check`
  (dependency-cruiser, adaptado a `apps/web/src/features/*/{domain,application,infrastructure}`);
  `gitleaks-action@v2` (exigia `GITLEAKS_LICENSE` em repo de organização, provável causa de CI
  não rodar) trocado pela CLI grátis. Ver `specs/E00-S06-sync-padrao-os-v3/`.
- **AC-2 resolvido:** hook `enforce-git-push-authority.sh` ativado (`chmod +x` + merge do
  `PreToolUse.Bash` em `.claude/settings.json`, mantendo o hook `Edit|Write` existente) após
  confirmação explícita do usuário em 2026-07-02. `git push` fora do `@devops` agora é bloqueado
  por máquina nesta sessão/repositório, não só por prosa no `AGENTS.md`.
- **v3.1.1 (correção sobre a v3.1.0 desta mesma story):** o caminho de CD deixou de ser o
  `.github/workflows/deploy.yml` (Action + `SUPABASE_ACCESS_TOKEN`, token de conta inteira) e
  passou a ser a **GitHub Integration nativa do Supabase** (Dashboard do projeto → Settings →
  Integrations → GitHub → "Deploy to production" — sem token nenhum no GitHub). `deploy.yml` foi
  **rebaixado a fallback** (gatilho automático desligado, só `workflow_dispatch`), documentado só
  para o caso de monorepo com mais de um projeto Supabase (não é o caso aqui). Ver
  `docs/ENVIRONMENTS.md` e `PADRAO-DE-QUALIDADE.md` (item 7a).
- **Pendente no GitHub/Supabase (ação humana, fora do meu alcance):** ativar a integração nativa
  no projeto novo (`nudannsrfvjggoergvyn`) com `main` como production branch, e declarar cada
  Edge Function real em `supabase/config.toml` — hoje esse arquivo só existe (com schemas + o
  Custom Access Token Hook do E00-S05) na branch `feat/E00-S05-*`, não em `main`; a declaração de
  funções (`[functions.<nome>]`) entra quando esse arquivo chegar em `main` (via merge de E00-S05
  ou nesta story) **e** houver uma função real além de `_template`/`_shared` (hoje não há).
- **E00-S06 pronto para PR** — falta só push + `gh pr create` (usuário optou por revisar local
  antes; não pushado ainda).
- **Próximo passo de E00-S05:** alguém com Docker rodar `supabase start && supabase db reset &&
  supabase test db` + validar login manual antes do merge — checklist completo em
  `specs/E00-S05-autenticacao-autorizacao/tasks.md` (só existe na branch `feat/E00-S05-*`). Como o
  Supabase foi reprovisionado, o `.env.local` dessa branch/sessão também precisa ser atualizado
  com o projeto novo antes de rodar os testes contra o banco hospedado.
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
| `E00-S06-sync-padrao-os-v3` | implementado, todos os ACs verdes | audit-esteira ✅ · eval:spec ✅ · typecheck ✅ · lint ✅ · test ✅ · arch:check ✅ |
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
- [x] ~~Supabase não provisionado~~ ✅ Resolvido, depois **reprovisionado** — projeto atual:
      `nudannsrfvjggoergvyn.supabase.co`. Projeto antigo (`ljvpmcamqydeklvkiigy`) obsoleto; migrations
      precisam ser reaplicadas do zero no projeto novo antes de qualquer teste contra banco hospedado.
      `.env.local` local já atualizado (URL + anon key); `SUPABASE_SERVICE_ROLE_KEY` ainda é a
      chave do projeto antigo — inválida, precisa ser buscada no dashboard do projeto novo.
- [ ] Ativar GitHub Integration nativa do Supabase no projeto novo (production branch = `main`) —
      ver `docs/ENVIRONMENTS.md`. Quem destrava: @devops/Lucas (é ação no dashboard, não em código).
- [ ] Evolution API: instância existe na Cloudfy mas webhook não apontado para Supabase Edge Function ainda. Quem destrava: @devops/Lucas.

## Ideias adiadas / backlog técnico
- Evals de laudo SPDA (comparação de saída LLM com laudos validados por engenheiro) → gatilho: primeira geração de laudo em produção
- Repriorização por IA no backlog GUT → gatilho: 3 meses de histórico de priorização
- Modo de Zé por número de técnico (DM direto) → gatilho: pedido explícito da Sinérgica

## Todos soltos
- [ ] Configurar CODEOWNERS (`.github/CODEOWNERS`) quando o time de desenvolvimento estiver definido
- [ ] Atualizar `docs/ENVIRONMENTS.md` quando URLs reais de staging/produção existirem
- [ ] Executar `pnpm run audit:deps` após provisionar e instalar dependências reais em CI
