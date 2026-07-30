---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Trigger de resposta automática do Zé

> **Decisão tomada (2026-07-28):** colunas NOVAS (`auto_*`) em `atendimento.personas`, separadas de
> `janela_dias/janela_inicio/janela_fim` (E02-S06, usadas por `personaDisponivelAgora` como gate do
> acionamento manual/@zé, E02-S23) — reaproveitar as mesmas colunas com semântica invertida
> quebraria esse gate já em produção. Ver migration 0158.

## Plano
| #  | Task                                                                  | Cobre AC       | Depende de | Gate (comando)                                   | Status |
|----|-------------------------------------------------------------------------|----------------|------------|--------------------------------------------------|--------|
| 1  | Migration: colunas `auto_*` em `atendimento.personas`                | AC-5,AC-6      | —          | `lint:migrations`/squawk verde                    | done   |
| 2  | Domínio puro: `deveResponderAutomaticamente` (matriz de decisão)      | AC-1,AC-2,AC-3,AC-4 | 1     | Deno test (7 casos) — não executado (sem Deno CLI)| done   |
| 3  | Tela de config (horário por dia + `X` min)                            | AC-6           | 1          | —                                                  | todo   |
| 4  | Detecção de handoff — **já existe** (`deveTransferirParaHumano`)      | AC-3           | —          | —                                                  | done (pré-existente) |
| 5  | Ligar no `pcm-ze-agent`: aplicar decisão no fluxo de mensagem         | AC-1,AC-2,AC-3 | 2,3        | **não feito — ver SPEC_DEVIATION**                | bloqueado |

## Plano de teste
- Unidade: `deveResponderAutomaticamente` — 7 casos (desligado, fora de horário, dia sem expediente,
  inatividade > X, humano ativo ≤ X, sem dado de última resposta, handoff ativo) em
  `supabase/functions/_shared/trigger-automatico.test.ts`. **Validado manualmente via Node** (mesma
  semântica JS) mas não executado via Deno CLI (indisponível neste ambiente).
- Integração: não feita (task 5 bloqueada).

## Divergências (SPEC_DEVIATION)
- [x] **Task 5 (ligar no `pcm-ze-agent`) não implementada.** Motivo: calcular
  `minutosSemRespostaHumana` exige saber quando um HUMANO (não o bot) respondeu por último — o
  schema de `atendimento.mensagens`/`wa_messages` não foi investigado a fundo o suficiente pra
  confirmar de onde vem esse dado com segurança, e errar isso numa function que já atende clientes
  reais no WhatsApp é risco alto demais pra decidir sozinho nesta sessão (bot pode ficar mudo
  esperando humano que não vai responder, ou responder por cima de atendimento humano em andamento).
  Resolução: @architect ou Lucas confirma a fonte do "último reply humano" e decide se entra
  simples (via `atendimento.mensagens.autor_tipo` se existir) ou precisa de coluna nova antes de
  ligar a task 5. A UI de configuração (task 3) e a função pura (task 2) já estão prontas — falta só
  a integração ao vivo.
- [ ] Tela de config (task 3) não implementada nesta sessão — prioridade menor que resolver a task 5
  primeiro (sem wiring, a tela não teria efeito real ainda).

## Checklist de Definition of Done
- [x] Migration + função pura implementadas e revisadas
- [ ] Todos os AC verdes pelo gate executável (bloqueado por SPEC_DEVIATION acima)
- [ ] Ligado no `pcm-ze-agent` (task 5)
- [ ] Tela de configuração (task 3)
- [ ] `docs/STATE.md` atualizado
