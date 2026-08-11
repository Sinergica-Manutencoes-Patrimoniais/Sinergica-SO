---
name: performance-e01-s145
description: Baseline, budgets e evidências da fluidez de Chamados/OS.
alwaysApply: false
---

# E01-S145 — Performance de Chamados

## Baseline estrutural (antes)

Medição por inspeção do caminho executado em `OrdensServicoPage` e build local em 2026-08-10:

| Medida | Antes |
|---|---:|
| Consultas críticas na abertura | 7–13, conforme volume |
| Página de OS | até 1.000 linhas por request, repetida até esgotar |
| Projeção | linha completa, incluindo descrição, observação e `auvo_detalhes` |
| Catálogos | clientes e funcionários carregados na abertura |
| Chamados abertos | request separado do feed de OS |
| Bundle JS | 2.418 MB minificado / 680,22 KB gzip |
| Cancelamento ao mudar filtro | inexistente |

O intervalo de requests vinha de: paginação interna do full-fetch de OS, KPIs, Chamados abertos,
clientes e funcionários. Detalhes e componentes podiam acrescentar novas consultas.

## Resultado local

| Medida | Depois | Evidência |
|---|---:|---|
| Consultas críticas na abertura | 2 | feed paginado + `fn_kpis_operacao` |
| Lista / Backlog | 50 itens | `ConsultaOperacao.limite` |
| Kanban | 30 por coluna | sete feeds independentes, sob demanda |
| Agenda | 200 por intervalo | cursor por `data_agendada` |
| Projeção | somente resumo | `pcm.operacao_itens` |
| Query crítica | <100 ms e Index Scan | pgTAP com `EXPLAIN (ANALYZE, FORMAT JSON)` |
| Bundle JS | 2.487 MB / 700,19 KB gzip | build Vite local |
| Crescimento da feature | **19,97 KB gzip** | budget `<=20 KB` atendido |

O bundle total continua acima do budget estrutural do produto. A redução pertence à E00-S21;
esta feature respeitou o teto incremental sem introduzir code splitting paralelo.

## Telemetria adicionada

- User Timing: `chamados:navigation-start`, `chamados:data-ready` e
  `chamados:content-painted`.
- O gate E2E anexa duração e payload das respostas do feed/KPIs para consolidar p95 no ambiente-alvo.
- Long tasks são coletadas no gate E2E via `PerformanceObserver`, sem custo permanente no bundle.

API p95, navegação p95, INP e payload real dependem de volume, rede e dispositivo de produção.
Devem ser capturados pelo evento acima antes de promover a migration; o gate local cobre plano de
query, limites, regressão do bundle e comportamento React.
