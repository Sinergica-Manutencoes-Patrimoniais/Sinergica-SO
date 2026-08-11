---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Chamados/OS: ocultar registros de ponto (INICIO/FIM VISITA)

> **Fonte da verdade.** Origem: Lucas (2026-08-10). "Na lista de chamado e OS, não deve exibir OS
> de 'INICIO VISITA' e 'FIM VISITA', são OS abertas pelos funcionários para registrar entrada e
> saída, nunca são tratadas. É registrado pois usamos na contagem de horas, porém não exibi como OS
> a ser tratada."

## Contexto de código
- `pages/OrdensServicoPage.tsx` (E01-S117/S118): tela única "Chamados e OS" (board Kanban +
  KPIs/métricas de operação) — busca via `listarOrdensServico(supabaseHubOsAdapter, ...)`.
- `domain/ordens-servico.ts`: `OrdemServicoOperacional.titulo` vem direto do título da tarefa no
  Auvo (`supabase/functions/_shared/auvo/os-from-task.ts`, `input.titulo` sem transformação) —
  técnicos abrem uma tarefa Auvo com título literal "INICIO VISITA"/"FIM VISITA" pra bater ponto;
  isso vira uma linha normal em `pcm.ordens_servico`, hoje sem distinção das OS de trabalho real.
  Não existe hoje nenhuma constante/predicado no código pra esse título — é convenção de uso do
  Auvo pelos técnicos, não um campo estruturado.
- `domain/apontamento-horas.ts` + `pages/RelatorioDiarioPage.tsx` (E01-S133): **usam essas mesmas
  linhas** pra calcular horas apontadas — **não podem ser filtradas daí**, só do board/lista de
  Chamados e OS. O pedido do Lucas é explícito nesse ponto ("é registrado pois usamos na contagem
  de horas").
- `domain/ordens-servico.ts` já tem predicados de filtro compostos (`ehOsAberta`, `filtrarOrdens`,
  `filtrarBacklogGut`, `calcularKpisOrdens`) — é o lugar natural pra mais um predicado.

## Resumo
OS cujo título é (ignorando maiúsculas/minúsculas e espaços nas pontas) exatamente "INICIO VISITA"
ou "FIM VISITA" são registros de ponto do técnico, não itens de trabalho. Elas continuam existindo
normalmente no banco (nada muda na sincronização Auvo nem no apontamento de horas) — só deixam de
aparecer na tela "Chamados e OS" (board, KPIs, contadores, Backlog GUT).

## Critérios de aceite

### AC-1: Não aparecem no board Kanban
- **Dado** OS com título "INICIO VISITA" ou "FIM VISITA" (case-insensitive, trim)
- **Quando** o operador abre a tela Chamados e OS
- **Então** essas OS não aparecem em nenhuma coluna do board.

### AC-2: Não entram nos KPIs/métricas
- **Dado** as mesmas OS
- **Então** não contam em `calcularKpisOrdens` nem em `calcularMetricasOperacao` exibidos na tela
  (total, abertas, em planejamento, backlog, sem técnico, etc.).

### AC-3: Não aparecem no Backlog GUT
- **Dado** as mesmas OS
- **Então** `filtrarBacklogGut` também as exclui (mesma regra, um só ponto de filtro no domínio).

### AC-4: Apontamento de horas não é afetado
- **Dado** a tela de Relatório de apontamento de horas / Relatório diário (E01-S72/S77/S133/S134)
- **Então** continuam usando essas OS normalmente pra calcular check-in/check-out e horas — o filtro
  desta story é exclusivo da tela Chamados e OS.

### AC-5: Comparação tolerante a variação
- **Dado** títulos com variação de caixa ou espaço ("Inicio Visita ", " fim visita")
- **Então** ainda são reconhecidos e ocultados (comparação normalizada, não `===` estrito).

## Casos de borda e erros
- Título parcialmente parecido mas não exato (ex. "Inicio Visita Extra", "Visita Inicio") — **não**
  é ocultado; só match exato normalizado evita esconder OS de trabalho real por engano.
- OS sem título (não deveria ocorrer, `titulo` é obrigatório) — não corresponde ao predicado, segue
  aparecendo normalmente.

## Fora de escopo
- Mudar como a Auvo sincroniza essas tarefas ou impedir sua criação — elas continuam existindo, só
  saem da visualização de tratamento.
- Um filtro configurável pelo usuário (lista de títulos a ocultar) — hardcode dos dois títulos
  conhecidos; se surgirem outros padrões de registro de ponto, é ajuste futuro.
- Acento diferente ("INÍCIO VISITA" com acento) não observado nos dados atuais — se aparecer, é
  SPEC_DEVIATION a registrar (ver `CLAUDE.md`), não assumido preventivamente aqui.

## Rastreabilidade
- Código: `domain/ordens-servico.ts` (novo predicado `ehOsRegistroVisita`), aplicado em
  `filtrarOrdens` (alimenta board/lista/timeline/calendário em `OrdensServicoPage.tsx`),
  `calcularKpisOrdens`, `calcularMetricasOperacao` (também usadas pelo cockpit `dashboard-pcm.ts`,
  E01-S136), `application/hub-os.ts` `listarBacklogGut` (função real do Backlog GUT — o
  `filtrarBacklogGut` do domínio não tem uso em produção hoje, recebeu o filtro por consistência).
- Não toca: `domain/apontamento-horas.ts`, `pages/RelatorioDiarioPage.tsx`,
  `pages/RelatorioClientePage.tsx` — mantêm as OS de ponto.
- **SPEC_DEVIATION SD-1:** a spec original não previa migration ("tier trivial-pequeno... sem
  migration" no `tasks.md`). Os KPIs padrão da tela (sem busca livre nem filtro de Cliente) vêm de
  `pcm.fn_kpis_ordens_servico` — RPC agregada no servidor (migration `0076`), não do array já
  filtrado no cliente. Sem alterar a RPC, o AC-2 ficaria inconsistente (KPI errado quando não há
  busca/filtro de cliente ativo). Resolução: migration `0173_E01-S142` recria a função com a mesma
  exclusão. Precisa de `supabase db diff`/`db push` revisado antes de valer em produção (ver
  `db/README.md`) — não aplicado automaticamente por esta sessão.
- ADRs relacionados: —
