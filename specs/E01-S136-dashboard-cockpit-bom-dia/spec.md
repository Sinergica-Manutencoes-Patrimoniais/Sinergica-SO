---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Dashboard PCM como cockpit "bom dia" do gestor

> **Fonte da verdade.** Origem: Lucas (2026-08-04). "O dashboard precisa de revisão — temos mais
> informação útil hoje. Imagine que é a tela de bom dia: o que um gestor gostaria de ver — quantas
> OS pra hoje, onde terei funcionários alocados, funcionário livre no dia, quantidade de chamado sem
> tratamento (sem tratamento = não estar em backlog/planejado/preventiva/planejamento), e outros
> pontos que você pode vislumbrar e sugerir."

## Contexto de código
- `pages/PcmDashboardPage.tsx` + `domain/dashboard-pcm.ts` (E01-S21): hoje é um conjunto de KPIs
  estáticos (`montarDashboardPcm(ordens, inspecoes, auvo)`) + sinais do campo Auvo + inspeções. Não
  tem a leitura "do dia" que um gestor quer ao abrir de manhã.
- Dado já disponível pra alimentar o cockpit: `pcm.ordens_servico` (status/`data_planejada`/técnico),
  Agenda do Técnico (E01-S104/S112), funcionários/técnicos (`tecnicos_cache`), chamados
  (`status="aberto"` = sem tratamento — E01-S88/S118), emergenciais C1 (E01-S100), backlog GUT,
  PMOC preventivas (E01-S03-S08), Saúde Auvo (E01-S123), apontamento de horas (E01-S72/S77).

## Definição — "chamado sem tratamento"
Chamado ainda **cru**: `status = "aberto"`, que **não** virou OS em nenhum estado operacional
(backlog, planejamento, preventiva, planejado). É o que está parado na coluna Solicitação sem
tratativa. Esse é o número que o gestor quer ver de manhã.

## Resumo
Redesenhar o dashboard do PCM como a **tela de bom dia**: leitura rápida do dia (OS de hoje,
alocação de técnicos, quem está livre, chamados sem tratamento) + destaques acionáveis. Cada bloco é
**clicável** e leva pra tela correspondente (board filtrado, agenda, backlog). Voltado a decisão de
gestão, não relatório.

## Blocos — PEDIDOS (obrigatórios)

### AC-1: OS para hoje
- **Dado** o dashboard aberto
- **Então** mostra **quantas OS estão previstas pra hoje** (`data_planejada` = hoje, não finalizadas),
  com quebra por status; clicar abre o board filtrado no dia.

### AC-2: Onde terei funcionários alocados hoje
- **Dado** a agenda/OS planejadas do dia
- **Então** mostra a alocação de técnicos de hoje (técnico → cliente/local), pra o gestor saber onde
  cada um estará; clicar leva à Agenda do Técnico.

### AC-3: Funcionário livre no dia
- **Dado** os técnicos ativos e as alocações de hoje
- **Então** mostra **quem está sem alocação hoje** (capacidade ociosa), pra remanejar.

### AC-4: Chamados sem tratamento
- **Dado** os chamados
- **Então** mostra a **quantidade de chamados sem tratamento** (status `aberto`, fora de
  backlog/planejamento/preventiva/planejado); clicar abre a coluna Solicitação; destaque quando > 0.

## Blocos — SUGESTÕES (TODAS entram; Fabricio refina depois)

> Decisão do Lucas (2026-08-04): implementar **todos** os blocos abaixo; o Fabricio dá feedback
> depois de ver funcionando (o que fica, o que sai, o que ajusta). Ver AC-8.

- **S1. Emergenciais C1 / SLA estourando** — chamados/OS emergenciais abertos e quanto falta pro SLA
  (2h, E01-S100). Vermelho quando vencendo.
- **S2. OS atrasadas** — `data_planejada < hoje` e não finalizada — o que ficou pra trás.
- **S3. Capacidade x demanda do dia** — OS de hoje ÷ técnicos disponíveis (o dia "cabe"?).
- **S4. Preventivas PMOC vencendo** — visitas/preventivas da semana (E01-S03-S08).
- **S5. Top backlog GUT** — 5 itens de maior prioridade esperando planejamento.
- **S6. Saúde Auvo** — nº de erros de sync (E01-S123), atalho pro drill-down.
- **S7. Resumo de ontem** — atalho pro Relatório Diário do dia anterior (E01-S134).
- **S8. Inspeções/assessments pendentes** — o que falta fechar (E01-S90).
- **S9. Ferramentas** — reservas/devoluções do dia, itens em atraso de devolução (E01-S64/S131).

## Critérios transversais

### AC-5: Blocos acionáveis
- **Dado** qualquer bloco do cockpit
- **Quando** o gestor clica
- **Então** navega pra tela correspondente já filtrada (não é só número morto).

### AC-6: Números corretos e "do dia"
- **Dado** os blocos do dia (OS hoje, alocação, livres, sem tratamento)
- **Então** refletem o dia local (pt-BR) e batem com o dado real.

### AC-7: Estados vazios claros
- **Dado** um dia tranquilo (0 OS, 0 sem tratamento, todos alocados)
- **Então** cada bloco mostra um estado positivo/vazio claro ("Nada pra hoje", "Sem chamados
  parados"), sem seção quebrada.

### AC-8: Todos os blocos sugeridos presentes
- **Dado** o cockpit entregue
- **Quando** o gestor abre
- **Então** os 4 blocos pedidos **e** os 9 sugeridos (S1-S9) estão presentes e acionáveis — o
  Fabricio refina depois (o que fica/sai/ajusta) via feedback, não por escolha prévia.

## Casos de borda e erros
- Técnico sem nome resolvido → fallback; alocação sem local → "local a definir".
- Saúde Auvo indisponível → bloco degrada, não derruba o dashboard.
- Muitas OS/técnicos → blocos com "ver todos" em vez de listar tudo.

## Fora de escopo
- Reescrever os relatórios (diário E01-S134 / cliente E01-S135) — o dashboard só linka.
- Personalização de widgets por usuário (arrastar/ocultar) — story futura se pedido.
- Mudar cálculo de KPIs existentes que continuam válidos.

## Rastreabilidade
- Código: `pages/PcmDashboardPage.tsx`, `domain/dashboard-pcm.ts` (agregações novas: OS hoje,
  alocação, livres, sem tratamento), `application/*`, adapters (`hub-os`/agenda/chamados/técnicos/
  saúde), componentes `ui/`.
- Reusa: E01-S104/S112 (agenda), E01-S118 (`calcularMetricasOperacao`/sem tratamento), E01-S100 (C1),
  E01-S123 (saúde), E01-S134 (relatório diário).
- ADRs relacionados: —
