---
name: E02-S31-relatorio-gasto-ia
description: Relatório de consumo de IA (inspeção, atendimento, previsões) com limite de quota e alerta
alwaysApply: true
---

# E02-S31 — Relatório de gasto de IA

## Contexto
Inspeção (PDF), atendimento (LLM), e previsões (scoring) usam API OpenRouter/LLM.
Lucas quer visão de **quanto foi gasto** em cada módulo, **limite de quota mensal**, e **alerta quando exceder**.

## Requisitos

### AC-1: Dashboard de gasto por módulo
- Exibir gasto (USD) em **Inspeção**, **Atendimento**, **Previsões** (separado)
- Período: mês atual, com picker de mês/ano
- KPIs: total, por módulo, custo médio por item/conversa

### AC-2: Limite de quota
- Configurável em `config.integracoes` (chave OpenRouter)
- Se `limite_quota_ia > 0`: mostrar barra de progresso (gasto % limite)
- Se gasto ≥ 90% limite: banner amarelo "Aviso: 90% da quota IA"
- Se gasto ≥ 100% limite: **desabilitar IA** (visível no módulo + toast "Quota de IA excedida")

### AC-3: Histórico de uso
- Tabela `ia_gasto_log` registra cada consumo (módulo, USD, timestamp, item_ref)
- Tela de "Histórico" mostra últimas 50 com filtro por módulo

### AC-4: Avisos inline
- Conversa de Atendimento: rodapé mostra "Custo: $X" de cada resposta
- Inspeção (import): preview mostra "IA: $X este relatório"

## Fora de escopo
- Integração com faturamento (E04)
- Retry automático se quota atingida (UX manual, sem fallback IA)
- Histórico arquivado > 90 dias (cron futuro)

## Tier
Pequeno (4 tabelas/views, 3 telas, cálculo síncrono).

---

## Tarefas

1. **Migration `0205`:** `ia_gasto_log` (module, usd_cents, created_at, ref_id, endpoint) + RLS FORCE
2. **Migration `0206`:** `config.integracoes` ganha `limite_quota_ia_usd` + view `ia_gasto_resumo_mes`
3. **Domínio:** `ia-gasto.ts` calcula `resumoGastoMes`, `verificarQuotaExcedida`
4. **Adapter:** `supabase-ia-adapter.ts` lê/escreve `ia_gasto_log`
5. **UI:** `ConfiguracaoIaPage` (Configurações > Integrações) com campo de limite
6. **UI:** `RelatorioGastoIaPage` novo (dashboard + histórico)
7. **UI:** Conversa Atendimento rodapé com custo
8. **UI:** Preview de inspeção mostra custo estimado
9. **Integração:** `_shared/openrouter.ts` registra custo de cada chamada em `ia_gasto_log`
10. **Testes:** unit (domínio) + pgTAP (RLS) + Playwright (UI)

---

## Validação
- `ci:local` verde
- Smoke: criar inspeção, gasto registra; limite atingido desabilita IA
- Playwright: modal de limite, histórico, rodapé da conversa
