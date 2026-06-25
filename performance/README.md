---
name: performance
description: Budgets e padrões de performance (front, API, banco). Puxe ao desenhar lista, query ou endpoint com volume.
alwaysApply: false
---

# Performance

> Performance é requisito, não polimento posterior. Defina **budget** antes de construir e trate
> estouro como bug. Honestidade: parte é **gate** (quando há app/medição), parte é **guia + eixo
> de design + item de DoD**. Mede-se no caminho crítico, não em tudo.

## Budgets (alvos)
| Área        | Métrica            | Budget         | Como medir                          |
|-------------|--------------------|----------------|-------------------------------------|
| Front (web) | LCP / INP / CLS    | <2,5s / <200ms / <0,1 | Lighthouse CI / Web Vitals     |
| Front       | Bundle inicial     | < 200 KB gzip  | `size-limit` / análise do bundler   |
| API/Edge Fn | Latência p95       | < 500 ms       | logs do provedor                    |
| Banco       | Query crítica      | < 100 ms       | `explain analyze`                   |

## Banco (a maior fonte de lentidão)
- **Índice para todo filtro/ordenção de query crítica.** Confirme com `explain analyze` que usa
  o índice (não `Seq Scan` em tabela grande). Ex.: `comissoes_venda_id_idx` (ver migration 0001).
- **Índice composto** alinhado ao filtro mais comum (ex.: `(workspace_id, created_at)`).
- **Sem N+1:** busque em lote (`in (...)`, join) em vez de uma query por item de uma lista.
- **Paginação obrigatória** em qualquer lista que cresce — nunca `select *` sem `limit`. Prefira
  keyset/cursor a `offset` grande.
- Selecione **só as colunas necessárias**; não traga blobs/JSON pesado para listar.

## Front
- Code splitting por rota; carregue o caro sob demanda (lazy).
- **Cache de dados** com TanStack Query (staleTime adequado; não refetch em loop). Estados
  loading/error/empty sempre tratados (não trava a UI).
- Imagem otimizada (tamanho/format), sem layout shift (reserve espaço → CLS).

## API / Edge Functions
- Não faça trabalho síncrono pesado no request — empurre para fila/cron quando possível.
- Idempotência em operação repetível (ver exemplo 0002) evita reprocessar e duplicar custo.
- Cache de leitura quente quando os dados toleram (com invalidação clara).

## Quando fazer load test
- Antes de um lançamento com pico esperado, ou quando o p95 se aproxima do budget. Ferramenta
  simples (k6/autocannon) no fluxo crítico — não teste de carga em tudo.

## Enforcement
- **Design (tier arquitetural):** eixo de performance no `design.template.md` é obrigatório.
- **DoD:** item de performance no `Definition-of-Done.md` (sem regressão de budget).
- **Gate automático:** quando houver app web, ligue Lighthouse CI / `size-limit` no pipeline.
