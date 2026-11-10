# Plano técnico — E01-S185

**Status:** especificada, não implementada · **Data:** 2026-10-26 · **Spec:** [spec.md](spec.md)

## Summary

Projeção paginada normaliza apenas metadados de integração por objeto e links de contexto. Cada fluxo continua dono dos comandos, idempotência e regra de precedência. Dispatcher valida permissão e encaminha reconciliação/retry ao proprietário com requestId/expectedRevision; não reexecuta POST genérico. Unicidade integração/tipoObjeto/objetoId/tipoDivergência/versão evita alertas duplicados. Worker de varredura observa pendências/leases em lote com cursor; não altera fatos financeiros ou decisões PCM diretamente. Painel TanStack Query invalida após ação e mostra estados de carregando/vazio/erro/sucesso, teclado/foco. Custos/payload completos nunca entram na projeção acessível a perfil sem permissão.

## Technical Context

TypeScript, React 19, TanStack Query e Supabase Postgres/RPC/Edge Functions; Auvo v2 por adapter servidor. Vitest para domínio/aplicação, Deno para integração com doubles e pgTAP para banco/policies. Consulta paginada, lotes limitados e cursor, sem N+1. Nenhuma API real nesta entrega.

## Reuso e mudanças delimitadas

`supabase/migrations/0050_E00-S11_auvo_sync_health.sql` possui `auvo_sync_state`/view de saúde. `supabase/functions/pcm-auvo-push/index.ts` registra estados do drain. Reutilizar `apps/web/src/features/pcm/pages/PcmDashboardPage.tsx`, `infrastructure/supabase-dashboard-pcm-adapter.ts` e view `pcm.auvo_sync_error_details` da migration 0166 (E01-S123) (saúde Auvo drilldown), claims de outbox e logs estruturados existentes; ampliar para tentativas/objeto, sem outra fila que dispute com E01-S168. Comercial e faturável seguem contratos E01-S181/E01-S182, não criar terceiro orçamento ou novo ledger financeiro.

## Contratos e gates

Provas de contratos de E01-S168/175/181/182 e política de recuperação por erro são pré-requisitos à habilitação real. 4xx determinístico não tem retry automático infinito; 429/5xx/rede usam backoff limitado, respeitando Retry-After quando disponível, e tentativa ambígua exige conciliação. Evidência deve conter ambiente/versão/executor sem secrets.

Ler `docs/planejamento/plano-manutencao/contratos-programa.md` e ADR-0026/0027/0028 antes de codar; contratos locais em [contracts/commands.md](contracts/commands.md). Se caminho de UI previsto não existir, localizar componente vigente, registrar ajuste técnico no plano, sem mudar AC/escopo. Nova migration recebe próximo número disponível na execução, nunca número reservado nesta especificação.

## Constitution Check

Antes/depois do desenho: schema de domínio, RLS FORCE, pgTAP permitido/negado, autorização servidor, audit append-only, secrets Vault; Edge CORS/JWT/rate-limit/Zod e problem+json com reqId; webhook HMAC constant-time. Migrations aditivas sem alterar aplicadas. DDD com domain puro e TanStack Query/invalidação para UI. Nenhuma exceção proposta. Tier arquitetural requer revisão adversarial e CI/db-tests antes do PASS de implementação.

## Project Structure e sequência

Domínio/aplicação/adapters em `apps/web/src/features/pcm/{domain,application,infrastructure}/`; handlers em `supabase/functions/`; testes DB em `supabase/tests/`; migrations futuras em `supabase/migrations/`. Modelos lógicos e comandos detalhados nesta pasta. Dependências E01-S168, E01-S175, E01-S181, E01-S182 precedem integração. Executar US1, US2 e US3 com testes antes de regra; finalização inclui UI, recuperação e revisão adversarial. MVP demonstrável é US1 em ambiente fake; liberação real requer conjunto completo e gate operacional.
