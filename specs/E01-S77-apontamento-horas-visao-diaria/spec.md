---
name: spec-E01-S77-apontamento-horas-visao-diaria
description: Contrato — visão diária de apontamento de horas por técnico (span do dia, soma de OS, anomalias, export, tendência).
alwaysApply: true
tier: pequeno
---

# Spec — Apontamento de Horas: visão diária por técnico

## Resumo
Evolui `ApontamentoHorasPage` (E01-S72/E01-S75) com uma aba "Por dia": agrupa os check-in/check-out
já capturados por OS (`pcm.ordens_servico.check_in_at/check_out_at`, origem Auvo) por técnico+dia,
mostrando a diferença do dia (1º check-in → último check-out) e a soma das OS trabalhadas naquele
dia, lado a lado, em horas:minutos — não mais decimal (`1,4h`). Sinaliza dia incompleto e
falta/hora-extra contra a jornada esperada do funcionário. Exporta CSV. Mostra tendência
semanal/mensal por técnico. Feedback do Lucas (2026-07-18): "essa sessão precisa ser rica, é a
forma que vamos mensurar o trabalho dos colaboradores."

## Decisões travadas (PO, via AskUserQuestion)
| Decisão | Escolha |
|---------|---------|
| Escopo desta rodada | Completo: diária + anomalias + export CSV + tendência |
| Diferença do dia × soma das OS | Mostrar os **dois**, lado a lado (divergência = tempo fora de OS) |
| Relação com a tela atual | Aba nova "Por dia" — mantém a visão atual (OS no período + agregados por cliente/técnico) intacta |

## Critérios de aceite

### AC-1: Visão diária por técnico
- **Dado** um técnico com OS com `check_in_at`/`check_out_at` no período filtrado
- **Quando** o usuário abre a aba "Por dia"
- **Então** vê uma linha por (técnico, dia) com a data, o primeiro check-in e o último check-out
  daquele dia

### AC-2: Diferença do dia (span)
- **Dado** uma linha de (técnico, dia) com check-in e check-out
- **Quando** a linha é exibida
- **Então** mostra a diferença entre o primeiro check-in e o último check-out em formato `HHhMMmin`
  (ex.: `8h24min`), nunca decimal

### AC-3: Soma das OS do dia
- **Dado** a mesma linha de (técnico, dia)
- **Quando** exibida
- **Então** mostra, separado da diferença do dia (AC-2), a soma das durações individuais de cada OS
  daquele dia (mesma lógica de `calcularHorasOs` já existente), também em `HHhMMmin`

### AC-4: OS trabalhadas no dia
- **Dado** uma linha de (técnico, dia)
- **Quando** o usuário expande a linha
- **Então** vê a lista das OS trabalhadas naquele dia (número, cliente, horário, duração individual
  em `HHhMMmin`)

### AC-5: Dia incompleto
- **Dado** um dia em que alguma OS tem check-in sem check-out (ou check-out sem check-in)
- **Quando** a linha desse (técnico, dia) é exibida
- **Então** é sinalizada visualmente como "incompleta", sem quebrar o cálculo das demais OS
  completas do mesmo dia (mesmo padrão de degradação graciosa de `calcularHorasOs`)

### AC-6: Falta / hora-extra contra jornada esperada
- **Dado** um funcionário com `jornada_diaria_horas` cadastrada
- **Quando** a diferença do dia (AC-2) é menor que a jornada esperada
- **Então** o dia é sinalizado como "abaixo da jornada"; quando maior, como "hora extra"; quando
  igual (tolerância de 15 min pra cima/baixo), sem sinalização
- **E** funcionário sem `jornada_diaria_horas` cadastrada nunca é sinalizado (neutro, não é erro)

### AC-7: Exportar CSV
- **Dado** a visão "Por dia" com filtros aplicados (período, técnico, cliente)
- **Quando** o usuário clica em "Exportar CSV"
- **Então** baixa um arquivo CSV com colunas: técnico, dia, check-in, check-out, diferença do dia,
  soma das OS, quantidade de OS, status (completo/incompleto/falta/hora-extra)

### AC-8: Tendência semanal/mensal
- **Dado** um técnico selecionado
- **Quando** o usuário abre a sub-visão de tendência
- **Então** vê totais de horas (soma das OS) agregados por semana, num intervalo maior que o filtro
  pontual da aba principal (ex.: últimas 8 semanas), pra identificar padrão ao longo do tempo

### AC-9: Visão atual preservada
- **Dado** a tela de Apontamento de Horas antes desta story
- **Quando** a aba "Por dia" é adicionada
- **Então** a lista de "OS no período" e os painéis "Horas por cliente"/"Horas por técnico"
  continuam funcionando exatamente como antes (nenhuma regressão)

## Casos de borda e erros
- OS sem `check_in_at` nem `check_out_at` → não entra em nenhuma linha de dia (AC-1), mas continua
  aparecendo normalmente na lista "OS no período" existente (AC-9).
- Check-in de uma OS num dia e check-out só no dia seguinte (cruza meia-noite) → a OS é atribuída
  ao dia do `check_in_at`; a soma da OS (AC-3) usa a duração real completa; a diferença do dia
  (AC-2) desse dia fica sem o check-out correspondente → dia marcado incompleto (AC-5).
- Duas OS do mesmo técnico no mesmo dia com horários sobrepostos (dado inconsistente vindo do
  Auvo) → soma das OS (AC-3) pode ultrapassar a diferença do dia (AC-2); não é bug do sistema, é
  sinal de dado a investigar — exibe normalmente, não bloqueia.
- Funcionário sem `jornada_diaria_horas` → AC-6 nunca sinaliza (default seguro).

## Fora de escopo
- Edição manual de check-in/check-out pela UI — dado vem só do Auvo (ADR-0006, PCM não escreve
  nisso).
- Geração de folha de pagamento formal — o CSV (AC-7) é insumo, não o relatório final.
- Alertas automáticos (e-mail/WhatsApp) por dia incompleto ou hora-extra — só sinalização visual
  na tela nesta story.

## Rastreabilidade
- Migration: `supabase/migrations/0099_E01-S77_jornada_diaria_funcionarios.sql` (renumerada de 0095 — S76 paralela consumiu 0095-0098).
- Domínio: `apps/web/src/features/pcm/domain/apontamento-horas.ts` (estendido).
- Application: `apps/web/src/features/pcm/application/apontamento-horas.ts` (estendido).
- Infra: `apps/web/src/features/pcm/infrastructure/supabase-apontamento-horas-adapter.ts` (estendido),
  `supabase-funcionarios-adapter.ts` (jornada).
- UI: `apps/web/src/features/pcm/pages/ApontamentoHorasPage.tsx` (aba "Por dia"),
  `FuncionariosPage.tsx` (campo jornada esperada).
