---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Ordens de Serviço: clicar num item abre o Chamado

> **Fonte da verdade.** Status: rascunho
> Origem: pedido do Lucas (2026-07-29). Desde E01-S99, Chamado é o ID único ponta a ponta — OS não
> tem mais numeração própria (o número exibido já é o do Chamado, `numero` deriva via trigger). O
> Lucas quer que a UI reflita isso: Chamado e OS são a mesma entidade em fases diferentes, não duas
> telas paralelas. "O fato de abrir a OS é o fato de ela ter ido pro Auvo como ordem de serviço do
> Chamado" — ou seja, a OS é só uma fase (pós-planejamento) do mesmo Chamado, não outro registro.

## Contexto de código
- `OrdensServicoPage.tsx` tem 4 visões (Kanban/Lista/Timeline/Calendário) que compartilham o mesmo
  `onSelecionar` → abre um painel de detalhe **só da OS** (`selecionadaId`/`selecionada`), sem link
  nenhum pro Chamado de origem.
- `pcm.ordens_servico.chamado_id` existe desde E01-S99 (migration `0151`) mas nunca foi exposto no
  domínio/adapter (`OrdemServicoOperacional` não tem `chamadoId`).
- `ChamadosPage.tsx` já tem `detalheAbertoId` (expande inline o card do Chamado na lista) mas não
  tem um jeito de chegar lá vindo de fora com um Chamado específico focado (só
  `NovaOrdemServicoModal`/`onCriada` navega pra `pcmView="ordens"`, nunca o caminho inverso).
- `HomePage.tsx` já tem o padrão de deep-link cross-view (`abrirOsDoCliente`/`osDeepLink`,
  `osIdInicialToken` em `OrdensServicoPage`) — mesma receita, sentido oposto.

## Resumo
> **Escopo revisado (Lucas, 2026-07-29):** ao investigar, o painel de detalhe da OS
> (`DetalheOs`) não é só uma tela de leitura — tem "Alterar status" rápido, "Editar" e "Expandir"
> (detalhes da tarefa Auvo: check-in/check-out, GUTD). Remover o painel removeria essas 3
> capacidades sem substituto. Decisão: o painel **continua existindo exatamente como hoje** — só
> ganha um botão novo "Ver Chamado" que navega pra `pcmView="chamados"` com o Chamado
> correspondente já expandido. Nenhuma das 4 visões (Kanban/Lista/Timeline/Calendário) muda o
> comportamento de clique.

## Critérios de aceite

### AC-1: Botão "Ver Chamado" no painel de detalhe da OS
- **Dado** o painel de detalhe de uma OS (`DetalheOs`, qualquer uma das 4 visões)
- **Quando** o operador clica em "Ver Chamado"
- **Então** a tela muda pra Chamados (`pcmView="chamados"`) com o Chamado correspondente já
  expandido na lista (mesmo comportamento de `detalheAbertoId`), sem precisar buscar manualmente.

### AC-2: Filtro que esconderia o Chamado é limpo ao navegar
- **Dado** um filtro ativo em Chamados (ex.: filtro por cliente) que faria o Chamado-alvo não
  aparecer na lista
- **Quando** a navegação de AC-1 acontece
- **Então** o filtro é limpo antes de focar o Chamado — o operador sempre vê o item que clicou.

## Casos de borda e erros
- OS sem `chamado_id` (não deveria existir depois de E01-S99, mas defensivamente): botão "Ver
  Chamado" fica desabilitado, não navega silenciosamente pro nada.
- Chamado cancelado/já finalizado: continua abrindo normalmente (histórico é sempre acessível).

## Fora de escopo
- Mudar o modelo de dados Chamado/OS — já são vinculados 1:1 desde E01-S99, esta story é só
  navegação/UX.
- Qualquer mudança no comportamento de clique das 4 visões (Kanban/Lista/Timeline/Calendário) —
  continuam abrindo o painel de detalhe da OS exatamente como hoje.
- Remover/reduzir "Alterar status", "Editar" ou "Expandir" (Auvo) do painel — ficam intactos.

## Rastreabilidade
- Código: `OrdensServicoPage.tsx`, `OsKanbanView.tsx`/`OsTimelineView.tsx`/`OsCalendarioView.tsx`
  (view de Lista, se existir componente próprio), `ChamadosPage.tsx`, `HomePage.tsx`,
  `domain/ordens-servico.ts`, `infrastructure/supabase-hub-os-adapter.ts`.
- Estende: E01-S99 (Chamado como ID único).
- ADRs relacionados: —
