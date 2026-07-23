---
name: spec-E01-S08-dashboard-gestao-pmoc
description: Contrato — painel de alertas cross-contrato no dashboard PMOC (triagem sem clicar contrato a contrato).
alwaysApply: true
tier: pequeno
---

# Spec — E01-S08: Dashboard e gestão de contratos PMOC

## Resumo
`PmocPage.tsx` já tem KPIs agregados (contratos ativos, equipamentos, visitas no mês, atrasadas,
alertas legais) e o detalhe rico de cada contrato (inventário, cronograma, microbiologia, NC — dos
S03/S04/S06). A lacuna real: os alertas (ART vencendo, laudo microbiológico pendente, NC aberta,
visita atrasada) só aparecem **dentro** do contrato selecionado. Com muitos contratos, achar quais
precisam de atenção exige clicar um por um. Esta story adiciona um **painel de triagem cross-contrato**
— lista, sem abrir cada contrato, quem precisa de ação, com atalho pra abrir direto o contrato certo.
100% frontend: o dado necessário já existe em `PmocContratoResumo` (nenhuma migration).

## Critérios de aceite

**AC-1 — Painel de alertas consolidado.** Given uma lista de contratos PMOC, When o dashboard
carrega, Then um painel mostra todos os contratos com pelo menos um alerta ativo (`status='renovar'`
OU `microbioPendentes>0` OU `ncsAbertas>0` OU `visitasAtrasadas>0`), agrupados por tipo de alerta.

**AC-2 — Contrato sem alerta não aparece no painel.** Given um contrato sem nenhuma condição de
alerta, When o painel renderiza, Then esse contrato não ocupa espaço nele (painel só lista o que
precisa de ação — não é uma segunda lista de todos os contratos).

**AC-3 — Atalho pro contrato.** Given uma linha do painel de alertas, When o usuário clica, Then a
lista/detalhe à direita seleciona aquele contrato (reusa `setSelecionadoId` já existente) — sem
navegação nova, sem duplicar o carregamento de dados.

**AC-4 — Ordenação por urgência.** Given múltiplos contratos com alerta, When listados, Then a ordem
prioriza: **NC alta aberta** > **ART vencendo** (`renovar`) > **microbiológico pendente** > **NC aberta
não-alta** (média/baixa, categoria própria — cobre o caso de `ncsAbertas>0` sem nenhuma `alta`) >
**visita atrasada** — um contrato com mais de um alerta aparece uma vez só, na categoria mais urgente
que tiver.

**AC-5 — Painel vazio é bom sinal.** Given nenhum contrato com alerta, When o painel renderiza, Then
mostra um estado "tudo em dia" (positivo, não um "sem dados" genérico) — reforça que ausência de
alerta é o caminho feliz, não um erro.

**AC-6 — Sem regressão.** Given os KPIs e a visão de detalhe já existentes, When o painel novo é
adicionado, Then eles continuam funcionando exatamente como antes.

## Casos de borda
- Contrato com NC alta E ART vencendo simultaneamente → aparece só na categoria mais urgente (NC
  alta), não duplicado em duas categorias (AC-4).
- Lista de contratos vazia (nenhum PMOC cadastrado ainda) → painel de alertas não renderiza (nem o
  estado "tudo em dia" — não há o que triagem, o estado vazio já existente da lista cobre isso).

## Fora de escopo
- Alertas cruzando telas (notificação push/e-mail) — já é fora de escopo desde S06, mesmo bloco de
  Edge Functions do S05.
- Filtro/busca textual na lista de contratos — não pedido, não é a dor (a dor é achar quem precisa
  de ação, não buscar por nome).

## Rastreabilidade
- Domínio: `apps/web/src/features/pcm/domain/pmoc.ts` (`contratosComAlerta`, `TipoAlertaPmoc`) + `pmoc.test.ts`.
- Application/infra: `PmocContratoResumo` ganha `ncsAltasAbertas: number` (application/pmoc-gateway.ts),
  computado em `mapContratoResumo` a partir do `dataset.ncs` **já carregado** para todos os contratos
  (`carregarDataset()` não filtra por contrato) — nenhuma query nova, só um campo a mais no resumo existente.
- UI: `apps/web/src/features/pcm/pages/PmocPage.tsx` (painel novo).
