---
name: E02-S31-relatorio-gasto-ia-tasks
description: Tasks executáveis para E02-S31, com paths e migrations reais confirmados
alwaysApply: false
---

# Tasks — E02-S31 — Relatório de gasto de IA

Owner: Claude (sessão Lucas) · Início: 2026-08-15

## Confirmações contra o codebase (antes de codar)
- Última migration existente: `0204_E03-S13_comment_dono_snapshots.sql` → próxima livre: `0205`.
- `config.integracoes` (migration `0103_E00-S12_config_integracoes.sql`) já existe, chave `openrouter`
  seedada em `0126_E01-S81_ia_titulo_os.sql`, `config_publico: {modelo, import_model}`.
- `_shared/openrouter.ts` (`chamarOpenRouterTexto`) não repassa `usage` do response hoje — só extrai
  `choices[0].message.content`. OpenRouter inclui `usage.cost` (USD) automaticamente em toda resposta
  não-streaming (confirmado via doc oficial do cookbook OpenRouter) — não precisa do parâmetro
  deprecated `usage: {include:true}`.
- `pcm-ze-agent/index.ts` tem 2 call sites inline (`extrairChamadoViaOpenRouter`,
  `extrairLeadViaOpenRouter`) que NÃO usam `_shared/openrouter.ts` — leem `OPENROUTER_API_KEY` de env
  direto. Fora do escopo mudar isso agora (E02-S34 mexe nisso); aqui só logamos custo quando disponível.

## Tarefas

1. **Migration `0205_E02-S31_ia_gasto_log.sql`**: schema `config` (já existe) · tabela
   `config.ia_gasto_log` (id uuid pk, modulo text check in ('inspecao','atendimento','previsoes'),
   usd_cost numeric(12,6) not null, modelo text, prompt_tokens int, completion_tokens int,
   ref_id uuid, endpoint text, created_at timestamptz default now()) · RLS FORCE, policy
   superadmin/supervisor leem, só service_role insere. Schema novo não se justifica (não é bounded
   context próprio, é telemetria de uma integração já existente em `config`).
2. **Migration `0206_E02-S31_quota_ia_e_resumo.sql`**: `config.integracoes` ganha coluna
   `limite_quota_ia_usd numeric(12,2)` (nullable, 0/null = sem limite) · view
   `config.ia_gasto_resumo_mes` (modulo, usd_total, qtde, mês truncado) agregando `config.ia_gasto_log`.
3. **Domínio** `apps/web/src/features/config/domain/ia-gasto.ts`: `resumoGastoMes(logs, mesRef)`,
   `verificarQuotaExcedida(totalUsd, limiteUsd)` → `{percentual, aviso90, excedida}`. Puro, sem I/O.
4. **Adapter** `apps/web/src/features/config/infrastructure/supabase-ia-adapter.ts`: lê
   `config.ia_gasto_resumo_mes` e `config.ia_gasto_log` (histórico paginado, filtro por módulo).
5. **UI** `ConfigIaPage.tsx`: campo `limite_quota_ia_usd` (input number) no formulário existente,
   salvo junto de `salvarMetadado` como coluna separada (não `config_publico`, é coluna própria —
   precisa de gateway novo ou extensão do `SalvarIntegracaoInput`).
6. **UI** `apps/web/src/features/config/pages/RelatorioGastoIaPage.tsx` nova: KPIs por módulo,
   picker de mês, barra de progresso da quota, banner 90%/100%, tabela histórico (últimas 50).
   Registrar em `CONFIG_NAV`/`HomePage.tsx` (`configTab: "gasto-ia"`).
7. **UI** rodapé de custo na conversa do Atendimento e preview de inspeção — feito nas próprias
   telas de origem (S33 cobre o rodapé da conversa; aqui só garantimos que o dado exista via task 9).
8. **Integração**: `_shared/openrouter.ts` — `chamarOpenRouterTexto` retorna também `usage` (cost,
   prompt_tokens, completion_tokens) quando presente; novo helper `registrarGastoIa(db, {modulo,
   usdCost, modelo, tokens, refId, endpoint})` insere em `config.ia_gasto_log`. Chamado pelos call
   sites que já usam o helper compartilhado (import de inspeção). Checar quota antes de chamar: se
   excedida, lançar erro tipado e a Edge Function correspondente responde 422 "Quota de IA excedida".
9. **Testes**: unit (`ia-gasto.test.ts` domínio) · pgTAP RLS (`ia.gasto_log`) — documentar se não
   rodável localmente (sem Docker) · Playwright (config de limite, dashboard, histórico).

## Fora de escopo (reafirmado do spec.md)
Integração com faturamento (E04) · retry automático · histórico arquivado > 90 dias.

## Dependências para as demais stories
- E02-S33 lê `config.ia_gasto_log` por `ref_id = mensagem.id`.
- E02-S34 não depende de S31, mas ambas tocam `_shared/openrouter.ts` — sequenciar (S31 primeiro,
  S34 depois) pra evitar conflito na mesma função.
