---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-07-02 por @dev (E00-S05 — Supabase Auth real + RBAC implementado, aguardando validação com Docker)

## Status geral
**Fase:** Casca concluída (E00-S04) + E00-S05 (Autenticação e Autorização) implementado em código na branch `feat/E00-S05-autenticacao-autorizacao`, ainda não mergeado.
**Gates (código):** pnpm test ✅ · typecheck ✅ · lint ✅ · audit-esteira ✅ (falhas pré-existentes em `.claude/memory/`, não relacionadas) · eval-spec-fidelity ✅ (não cobre specs `E0N-S0N`, só `NNNN-*`)
**Gates (banco, pendentes):** `supabase db reset`, `supabase test db` (pgTAP) e validação manual de login **não executados** — ambiente de desenvolvimento sem Docker. Ver `specs/E00-S05-autenticacao-autorizacao/tasks.md` → "Pendências antes do merge".

## Em andamento / próximo passo
- **Branch atual:** `feat/E00-S05-autenticacao-autorizacao` — Supabase Auth real (login/logout/sessão)
  substituindo o bypass dev, RBAC via claim `user_role` no JWT (ADR-0003), RLS aplicada às 7
  tabelas de domínio existentes. 11 commits locais, nenhum push ainda.
- **Próximo passo imediato:** alguém com Docker rodar `supabase start && supabase db reset &&
  supabase test db` + validar login manual (`pnpm dev`) antes do merge — checklist completo em
  `specs/E00-S05-autenticacao-autorizacao/tasks.md`. Depois, `@qa` valida e `@devops` abre o PR.
- **Branches anteriores ainda pendentes de PR** (`Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`):
  - `docs/E01-S03-pmoc-spec` — PMOC spec + rename OS→SO + design system
  - `feat/E00-S03-dashboard-geral` — auth bypass + Dashboard Geral
  - `feat/E00-S04-sidebar-logo` — sidebar colapsável + logos reais Sinérgica
- **Próximo passo de feature (depois de E00-S05 mergeada):** E01-S09 — PCM telas de operação com
  dados reais (agora que há RLS e sessão real); ou `specs/0002` (abertura de chamado via Zé).

## Specs implementadas / artefatos prontos
| Spec | Status | Gate |
|------|--------|------|
| `0001-priorizacao-backlog-gut` | implementado, todos os ACs verdes | pnpm test |
| `0002-abertura-chamado-ze` | aprovado (aguarda implementação — Mês 2) | — |
| `E00-S03-dashboard-geral` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S04-sidebar-logo` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S05-autenticacao-autorizacao` | **código implementado**, gates de banco pendentes de Docker | typecheck ✅ · lint ✅ · pnpm test ✅ · `supabase test db` pendente |
| `specs/E01-S03-pmoc-schema/design.md` | design arquitetural criado (tier arquitetural) | revisão humana |

## Decisões recentes
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
- [x] ~~Supabase não provisionado~~ ✅ Resolvido — `ljvpmcamqydeklvkiigy.supabase.co` · migration `0001` aplicada · `.env.local` configurado.
- [ ] **E00-S05 precisa de Docker local** para rodar `supabase start`/`supabase test db` e validar de verdade os gates de AC-8/AC-9 (RLS) e o Custom Access Token Hook antes do merge. Quem destrava: quem tiver Docker disponível (Lucas ou outra sessão).
- [ ] Registro do Custom Access Token Hook e exposição dos schemas de domínio na API **em produção** (Dashboard do Supabase hospedado) — passo manual, não coberto por migration. Quem destrava: @devops/Lucas, depois que E00-S05 mergear.
- [ ] Evolution API: instância existe na Cloudfy mas webhook não apontado para Supabase Edge Function ainda. Quem destrava: @devops/Lucas.

## Ideias adiadas / backlog técnico
- Evals de laudo SPDA (comparação de saída LLM com laudos validados por engenheiro) → gatilho: primeira geração de laudo em produção
- Repriorização por IA no backlog GUT → gatilho: 3 meses de histórico de priorização
- Modo de Zé por número de técnico (DM direto) → gatilho: pedido explícito da Sinérgica

## Todos soltos
- [ ] Configurar CODEOWNERS (`.github/CODEOWNERS`) quando o time de desenvolvimento estiver definido
- [ ] Atualizar `docs/ENVIRONMENTS.md` quando URLs reais de staging/produção existirem
- [ ] Executar `pnpm run audit:deps` após provisionar e instalar dependências reais em CI
