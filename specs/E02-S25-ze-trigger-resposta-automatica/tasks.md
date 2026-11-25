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
| 3  | Tela de config (horário por dia + `X` min)                            | AC-6           | 1          | `vitest src/features/atendimento/domain/trigger-automatico.test.ts` (9/9) + `tsc --noEmit` | done (2026-11-25) |
| 3b | Migration 1881: `persona_janela_automatica` (janela POR DIA, AC-6)    | AC-6           | 1          | `supabase test db supabase/tests/E02-S25_trigger_automatico.test.sql` | done (2026-11-25) |
| 4  | Detecção de handoff — **já existe** (`deveTransferirParaHumano`)      | AC-3           | —          | —                                                  | done (pré-existente) |
| 5  | Ligar no `pcm-ze-agent`: aplicar decisão no fluxo de mensagem         | AC-1,AC-2,AC-3 | 2,3        | `deno check` + `deno test _shared/trigger-automatico.test.ts` (18/18) + pgTAP de 1881 | done (2026-11-25) |
| 5b | Reagendamento da fila quando a espera de `X` ainda não venceu (AC-2)  | AC-2           | 5          | `deno test` (`minutosAteAssumirPorInatividade`, 4 casos) | done (2026-11-25) |
| 5c | Humano assumir cancela o que o Zé tinha agendado (porte TriviAtende)  | AC-3,AC-4      | 3b         | pgTAP `E02-S25_trigger_automatico.test.sql`       | done (2026-11-25) |

## Plano de teste
- Unidade: `deveResponderAutomaticamente` — 7 casos (desligado, fora de horário, dia sem expediente,
  inatividade > X, humano ativo ≤ X, sem dado de última resposta, handoff ativo) em
  `supabase/functions/_shared/trigger-automatico.test.ts`. **Validado manualmente via Node** (mesma
  semântica JS) mas não executado via Deno CLI (indisponível neste ambiente).
- Integração: não feita (task 5 bloqueada).

## Divergências (SPEC_DEVIATION)

### Abertas nesta rodada (2026-11-25)
- [x] **A janela da persona (E02-S06) é ignorada no acionamento automático.** `personaDisponivelAgora`
  (`janela_dias`/`janela_inicio`/`janela_fim`) é o gate de "quando o Zé PODE ser acionado por
  menção". Se ele continuasse valendo no caminho automático, uma persona com janela 08–18 ficaria
  muda exatamente à noite — que é o horário que o AC-1 existe para cobrir. O gate continua
  valendo integralmente no caminho por menção (comportamento de produção intocado); só o
  acionamento automático passa por cima dele, e isso está marcado no código
  (`acionamentoAutomatico`). Se a intenção for o contrário (persona muda fora da janela mesmo no
  automático), é uma linha de código e um teste — mas aí o AC-1 deixa de ser alcançável.
- [x] **Reativação após handoff não ganhou gatilho próprio.** A spec deixa em aberto ("default:
  próxima janela de ativação"). Implementado o default: enquanto `conversas.modo = 'pausado'`, o
  trigger silencia (AC-3); devolver a conversa (`fn_definir_handoff` com `'devolver'`, que já
  existe) volta o modo para `'auto'` e o trigger passa a valer de novo. Não foi criado nenhum
  mecanismo novo de reativação automática.
- [x] **Aviso de "fora do horário, retornamos amanhã" não implementado.** O caso de borda da spec
  deixa a decisão para a implementação. Escolha: o Zé responde normalmente fora do horário
  (AC-1) — não há um segundo caminho de "mensagem fixa de ausência". Mensagem fixa é um recurso
  do TriviAtende (`protecao.mensagemTeto` e afins) que não foi portado; ver abaixo.
- [x] **Do TriviAtende, NÃO foi portado o `despacho_ritmo` completo** (debounce por conversa com
  lease, `chegadas_rapidas`/laço, atraso proporcional ao tamanho do texto, `outbox` +
  `reserva_entrega_resposta` com idempotency-key e `resultado_incerto`). Motivo: aqui o
  equivalente é `atendimento.wa_queue` + `fn_debounce_wa_queue`, que JÁ existe, já é drenado por
  cron de 1 minuto e já está em produção. Portar o modelo de lá seria trocar um sistema de fila
  vivo por outro — exatamente o tipo de duplicação que esta rodada deve evitar. O que foi portado
  é a IDEIA que faltava: a espera vive numa linha durável com prazo (`wait_until` reagendado +
  `reagendamentos` como teto), e quem assume a conversa cancela o que estava agendado
  (`trg_cancelar_fila_ze_ao_assumir`, equivalente de `cancelar_intencoes_ao_assumir`).

### Resolvidas nesta rodada
- [x] ~~**Task 5 (ligar no `pcm-ze-agent`) não implementada** — faltava saber de onde vem o
  "último reply humano".~~ **Resolvida em 2026-11-25**: vem de `atendimento.mensagens` com
  `direcao='saida'` e `origem_envio in ('formulario','celular')`, coluna que a E02-S32 (0207) e a
  E02-S39 (1850) já tinham estabelecido. `'ia'` (o próprio Zé) e `'celular_automatico'`
  (automática do WhatsApp Business) ficam de fora — se contassem, o Zé ficaria mudo esperando um
  humano que nunca falou. Encapsulado em `atendimento.fn_minutos_sem_resposta_humana`, com índice
  parcial próprio e pgTAP provando os quatro casos. Texto original abaixo, preservado:

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
