---
name: design
description: Technical Design Doc — métricas de Atendimento computadas server-side (edge function) com janelas de período.
alwaysApply: false
---

# Technical Design Doc — Métricas server-side de Atendimento

> **Tier:** arquitetural · **Status:** rascunho
> **Autor:** sessão B · **Revisores:** Lucas · **Data:** 2026-07-08
> Responde: **como** produzir o `SnapshotAtendimento` que alimenta o painel de paridade com o heziomos,
> corretamente e sem o cap de 1000 linhas.

## Contexto da funcionalidade
O painel atual (`AtendimentoDashboardPage.tsx`) computa ~3 KPIs **no cliente**, sobre a lista de conversas
retornada por `listarConversas` — que herda o **cap default de 1000 linhas do PostgREST**. Isso (a) subconta
em volume real e (b) não calcula métricas que exigem varrer mensagens (FRT, deflexão, aging, CSAT). O
heziomos resolve isso com a Edge Function `crm-atendimento-metrics` que agrega server-side e devolve um
snapshot pronto + séries por período. Esta story porta esse padrão para a arquitetura Sinérgica. Fundação
de E02-S11 (painel) e E02-S12 (widgets avançados). Ver `product.md`.

## Goals / Non-goals
**Goals**
- Edge Function `atendimento-metrics` devolve `SnapshotAtendimento` completo por janela (Hoje/7d/30d).
- Agregação server-side correta acima de 1000 conversas.
- Função pura `computarSnapshot` isolada de I/O, testável com datasets sintéticos.

**Non-goals**
- UI do painel/widgets — E02-S11/S12 (esta story é só o dado).
- Qualquer escrita/config — read-only.

## Design proposto

### Contrato do snapshot
```ts
type SnapshotAtendimento = {
  periodo: 'hoje' | '7d' | '30d'
  filaSemAtendente: number
  abertas: number
  naoLidas: number
  maisAntigaNaFilaMs: number
  frtMedioSegundos: number | null
  abertasHoje: number
  abertasHojeDeltaPct: number | null      // vs ontem
  autonomiaPct: number | null             // ze / (ze + humano)
  aging: { faixa: '0-1h'|'1-4h'|'4-24h'|'+24h', total: number }[]
  mixCanal: { canal: string, total: number }[]
  mixIa: { modo: 'ia'|'humano'|'pausado', total: number }[]
  escalonamento: { total: number, motivos: { motivo: string, total: number }[] }
  deflexaoPct: number | null
  csat: { media: number | null, respostas: number }
  // séries (E02-S12): volumeDiario[], sla, throughput, cargaAtendente[], heatmapHora[]
}
```

### Onde agrega — RPC SQL + Edge Function fina
Padrão do projeto: uma **RPC `security definer` em `atendimento`** faz o trabalho pesado em SQL
(`count`/`avg`/`date_trunc`/`filter`) sobre `atendimento.conversas` + `atendimento.mensagens` para a janela
pedida — SQL não sofre o cap do PostgREST. A Edge Function `atendimento-metrics` chama a RPC, monta o
`SnapshotAtendimento` e devolve. A derivação que não é trivial em SQL (buckets, percentuais, delta) fica na
função pura `computarSnapshot(linhasAgregadas)` (TS), testável isolada.

```
UI (painel) → gateway/adapter → invoke("atendimento-metrics", {periodo})
                                    └── RPC atendimento.fn_metrics_snapshot(p_periodo)  [agrega em SQL]
                                    └── computarSnapshot(rows)  [buckets/percentuais/delta, puro]
                                    └── SnapshotAtendimento
```

Alternativa de agregar tudo em Deno lendo linha a linha é rejeitada (reintroduz o cap / puxa volume à toa).

### Janelas de período
A RPC recebe `p_periodo` e resolve o intervalo (`now() - interval`). Séries temporais (volume/dia, atividade
IA) vêm agrupadas por `date_trunc('day', ...)` dentro da janela. O delta "abertas hoje vs ontem" compara
duas janelas de 1 dia.

## Cobertura dos 5 eixos

### 1. Tech stack
Edge Function Deno (padrão `supabase/functions/_template`), RPC PL/pgSQL. Sem lib nova. Charts ficam na UI (E02-S11/S12).

### 2. Arquitetura base
`features/atendimento`: `domain/dashboard-atendimento.ts` ganha `SnapshotAtendimento` + `computarSnapshot`
(puro); `application/dashboard-atendimento-gateway.ts` ganha `obterSnapshot(periodo)`; `infrastructure`
ganha o adapter que invoca a função. Mantém o hexagonal existente. Fronteira: nova Edge Function read-only
no schema `atendimento`.

### 3. Infra
Nova Edge Function + 1 migration (RPC + índices). **Índices** em `atendimento.conversas`
(`status`, `created_at`, `canal`, `modo`, `assumida_por`) e `atendimento.mensagens` (`conversa_id`,
`remetente`, `created_at`) para a agregação por período ser indexada. Sem novo runtime/fila.

### 4. Qualidade
- **Unidade (TS):** `computarSnapshot` — FRT médio, aging buckets, autonomia/deflexão/delta, divisão por zero → `null` (não `NaN`).
- **Integração/pgTAP:** contagem correta com **>1000 conversas** (AC-2), janelas de período (AC-3), RLS da RPC.
- **Budget:** RPC p95 < ~500ms para 30d; agregação indexada, sem full scan; paginação não se aplica (retorna agregado, não linhas).

### 5. Observabilidade
Log estruturado da Edge Function com `periodo` + duração da RPC. O snapshot é a própria telemetria de
negócio do painel. Sem alerta novo nesta story (o painel E02-S11 destaca fila/SLA em vermelho).

## Mapa de dependências
| Dependência | Tipo | Descrição | Métodos / endpoints |
|-------------|------|-----------|---------------------|
| `atendimento.conversas`/`mensagens` | Tabela | Fonte das métricas | RPC `atendimento.fn_metrics_snapshot` |
| Pesquisas/CSAT | Tabela | Nota de satisfação | join na RPC (se a fonte existir; senão CSAT = null documentado) |
| E02-S11/S12 | Consumidor | Painel + widgets | `obterSnapshot(periodo)` |

## Alternativas consideradas
| Alternativa | Prós | Contras | Por que (não) escolhida |
|-------------|------|---------|-------------------------|
| A (escolhida) RPC SQL + Edge fina + `computarSnapshot` puro | Foge do cap, agregação indexada, derivação testável isolada | Uma migration + RPC a manter | Alinha com o padrão do projeto e com o heziomos |
| B Agregar em Deno lendo linhas | Sem SQL de agregação | Sofre o cap de 1000 / puxa volume; lento | Rejeitada — é exatamente o problema atual |
| C Materialized view + refresh | Leitura barata | Staleness; complexidade de refresh para "do agora" | Rejeitada no MVP; considerar se a RPC ficar cara |

## Trade-offs e consequências
Ganha: números corretos em qualquer volume + base para todos os widgets. Aceita: a lógica de agregação vive
em SQL (menos portável que TS) — mitigado mantendo a derivação fina em `computarSnapshot` puro.

## Riscos
| Risco | Descrição | Prob. × Impacto | Ações / mitigações |
|-------|-----------|-----------------|--------------------|
| Fonte de CSAT/escalonamento inexistente | Colunas/tabela não existem ainda | médio × médio | Campo retorna `null`/0 documentado; não inventar dado; sinalizar em SPEC_DEVIATION |
| RPC cara em 30d | Full scan sem índice | médio × médio | Índices dedicados (eixo 3); budget p95; opção C (matview) como escape |
| Deno/pgTAP não rodam local | Sem Deno CLI/Docker | alto × baixo | Mesma ressalva Auvo — validar no CI `db-tests` |

## Roadmap da feature
| Fase | Entrega | Depende de |
|------|---------|------------|
| 1 (MVP) | RPC + Edge + snapshot dos KPIs/aging/mix/IA/CSAT para E02-S11 | — |
| 2 | Séries (volume/SLA/heatmap/throughput/carga) para E02-S12 | 1 |

## Questões em aberto
- [ ] Existe fonte de CSAT e de motivo de escalonamento nas tabelas atuais de `atendimento`? Se não, esses campos saem `null` no MVP — confirmar com Lucas se cria a fonte agora ou depois.
- [ ] Definição exata de "escalou para humano" e "deflexão" (fechada pela IA) para casar com o heziomos.

> ADR a criar: `docs/adr/000N-metricas-atendimento-server-side.md` (agregar server-side via RPC/Edge em vez de client-side — decide o padrão dos dashboards do módulo).
