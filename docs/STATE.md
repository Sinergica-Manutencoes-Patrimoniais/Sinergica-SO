---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-07-01 por @devops (migração repo → Sinergica-SO; Supabase provisionado)

## Status geral
**Fase:** Casca concluída — E00-S04 implementado. Repo migrado para `Sinergica-Manutencoes-Patrimoniais/Sinergica-SO` (Lucas é owner). Supabase provisionado.
**Gates:** pnpm test ✅ · typecheck ✅ · lint ✅ · audit-esteira ✅ · eval-spec-fidelity ✅

## Em andamento / próximo passo
- **Branches no novo repo** (`Sinergica-Manutencoes-Patrimoniais/Sinergica-SO`) — todas pushadas:
  - `docs/E01-S03-pmoc-spec` — PMOC spec + rename OS→SO + design system
  - `feat/E00-S03-dashboard-geral` — auth bypass + Dashboard Geral
  - `feat/E00-S04-sidebar-logo` — sidebar colapsável + logos reais Sinérgica ← **branch atual**
- **Próximo passo imediato:** abrir PRs (`gh pr create`) para as 3 branches pendentes de merge em `main`
- **Próximo passo de feature:** E01-S09 — PCM telas de operação com mock data (listagem OS, modal detalhes, backlog GUT completo)
- **Próximo passo (Mês 2):** provisionar Netlify real; implementar `specs/0002` + spec de E01-S03 (tem design.md pronto)

## Specs implementadas / artefatos prontos
| Spec | Status | Gate |
|------|--------|------|
| `0001-priorizacao-backlog-gut` | implementado, todos os ACs verdes | pnpm test |
| `0002-abertura-chamado-ze` | aprovado (aguarda implementação — Mês 2) | — |
| `E00-S03-dashboard-geral` | implementado, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `E00-S04-sidebar-logo` | **implementado**, todos os ACs verdes | typecheck ✅ · lint ✅ |
| `specs/E01-S03-pmoc-schema/design.md` | design arquitetural criado (tier arquitetural) | revisão humana |

## Decisões recentes
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
