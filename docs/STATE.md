---
name: STATE
description: Memória de trabalho volátil — onde paramos, próximo passo, bloqueios.
alwaysApply: true
---

# STATE — Memória viva do projeto

> Memória de trabalho **entre sessões** (humanos e agentes). É **volátil**: atualizada o tempo
> todo. Diferente do **ADR** (decisão durável e imutável). Decisão estrutural → ADR; estado do
> trabalho → aqui. Atualize ao **pausar/encerrar**; leia ao **retomar**. Use a skill `/handoff`.

**Última atualização:** 2026-07-01 por @architect (sessão PMOC + rename OS→SO)

## Status geral
**Fase:** Casca concluída — specs PMOC incorporadas; aguarda push/PR para `Sinergica-M-P/Sinergica-OS`.
**Gates:** pnpm test ✅ · typecheck ✅ · lint ✅ · audit-esteira ✅ · eval-spec-fidelity ✅

## Em andamento / próximo passo
- **Branch local:** `docs/E01-S03-pmoc-spec` — 2 commits prontos, aguardando acesso de push ao repo `Sinergica-M-P/Sinergica-OS`.
  - Commit 1: `chore(E00-S02)` — design system brand tokens (navy/orange/paper, Google Fonts)
  - Commit 2: `docs(E01-S03)` — PMOC spec + rename OS→SO + stories E01-S03 a E01-S08 (19 arquivos, 535 inserções)
- **Próximo passo imediato:** após acesso concedido → `git push origin docs/E01-S03-pmoc-spec` + `gh pr create`
- **Próximo passo (Mês 2):** provisionar Supabase + Netlify reais; implementar `specs/0002` + spec de E01-S03 (tem design.md pronto)

## Specs implementadas / artefatos prontos
| Spec | Status | Gate |
|------|--------|------|
| `0001-priorizacao-backlog-gut` | implementado, todos os ACs verdes | pnpm test |
| `0002-abertura-chamado-ze` | aprovado (aguarda implementação — Mês 2) | — |
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
- [ ] **Git push bloqueado:** `LmAzevedo94` tem apenas acesso `pull` em `Sinergica-M-P/Sinergica-OS`. Quem destrava: Fabrício / admin da org Sinérgica — conceder acesso `push` (ou `admin`) ao `LmAzevedo94` e ao time Trívia Studio.
- [ ] Supabase: projeto ainda não provisionado (URL/anon key reais ausentes). Quem destrava: @devops/Lucas.
- [ ] Evolution API: instância existe na Cloudfy mas webhook não apontado para Supabase Edge Function ainda. Quem destrava: @devops/Lucas.

## Ideias adiadas / backlog técnico
- Evals de laudo SPDA (comparação de saída LLM com laudos validados por engenheiro) → gatilho: primeira geração de laudo em produção
- Repriorização por IA no backlog GUT → gatilho: 3 meses de histórico de priorização
- Modo de Zé por número de técnico (DM direto) → gatilho: pedido explícito da Sinérgica

## Todos soltos
- [ ] Configurar CODEOWNERS (`.github/CODEOWNERS`) quando o time de desenvolvimento estiver definido
- [ ] Atualizar `docs/ENVIRONMENTS.md` quando URLs reais de staging/produção existirem
- [ ] Executar `pnpm run audit:deps` após provisionar e instalar dependências reais em CI
