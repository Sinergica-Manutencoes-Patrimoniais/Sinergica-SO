# Implementation Plan: E01-S180 — Despesas previstas e realizadas por Visita

**Branch**: `codex/handoff-plano-manutencao` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)
**Status**: Especificada — implementação não iniciada

## Summary

PCM registra despesas previstas e realizadas na Visita; rateio por OS é opcional e não multiplica despesa nem cobrança.

## Technical Context

- TypeScript, React 19, Supabase/PostgreSQL, TanStack Query e Zod existentes; sem dependência nova prevista.
- Testes: Vitest (domain/application), pgTAP em Supabase local (RPC/RLS/concorrência), Playwright para jornada crítica.
- Plataforma: web; listas paginadas, consultas agregadas sem N+1; dinheiro inteiro em centavos.
- Dependências: E01-S171 (Visita) e E01-S170 (autorização).
- Contrato global: [contratos-programa.md](../../docs/planejamento/plano-manutencao/contratos-programa.md).
- Decisões: [ADR-0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [ADR-0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [ADR-0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md); ler os três antes de implementar. Não alterar ADR anterior silenciosamente.

## Constitution Check

Pré e pós-design: desenho compatível com migrations aditivas, FORCE RLS, pgTAP positivo/negativo, audit append-only, segredo servidor, autorização por ação no servidor e DDD sem import entre features. TanStack Query obrigatório nas superfícies tocadas. Dinheiro em centavos, request_id único e conflitos de revisão explícitos. Nenhuma exceção constitucional prevista; verificação é tarefa futura, não resultado já executado.

## Phase 0 — Research

- Base verificada: `supabase/migrations/0079_E01-S54_despesas_auvo.sql`.
- Base verificada: `apps/web/src/features/financeiro/application/financeiro-gateway.ts`.
- Base verificada: `apps/web/src/features/financeiro/application/robustez.ts`.

Criar agregado oficial aditivo; manter pcm.despesas como espelho histórico Auvo. Conferir vínculo com Financeiro via contrato/RPC e chave de origem, sem importar feature Financeiro no PCM. Anexos em bucket privado com policies por Cliente e permissão de despesas.

## Phase 1 — Design

### Estrutura e responsabilidades

- `apps/web/src/features/pcm/domain/despesas-visita.ts`: invariantes puras e transições, sem I/O/framework.
- `apps/web/src/features/pcm/application/despesas-visita.ts` e `apps/web/src/features/pcm/application/despesas-visita-queries.ts`: casos de uso, gateway e Query Keys com invalidação/cancelamento.
- `apps/web/src/features/pcm/infrastructure/supabase-despesas-visita-adapter.ts`: adaptação Supabase; respeitar adapter existente quando for a menor mudança.
- `apps/web/src/features/pcm/pages/DespesasVisitaPage.tsx`: interface operacional, carregando/vazio/erro/sucesso e teclado; custos restritos no servidor.
- `packages/shared/src/despesas-visita-contracts.ts`: DTO intercontexto público/servidor sem import entre features.
- `supabase/tests/E01-S180_despesas_visita_us1.test.sql`, `E01-S180_despesas_visita_us2.test.sql` e `E01-S180_despesas_visita_us3.test.sql`: autorização, idempotência e vínculos.
- `apps/web/e2e/despesas-visita.spec.ts`: jornada crítica isolada sem serviço externo real.

### Persistência e transação

Ver [data-model.md](data-model.md) e [contracts/commands.md](contracts/commands.md). Alocar número da migration somente na implementação consultando `db/README.md` e maior sequência aplicada. Criar migration aditiva em `supabase/migrations/` com ID E01-S180; nunca editar as bases citadas. Constraint, permissões, evento auditável e efeito do comando pertencem à mesma transação; request_id guarda resposta anterior e rejeita payload divergente.

### Segurança e compatibilidade

Políticas permitidas e negadas por papel/Conta/ação; não confiar em valor, Cliente ou papel enviados no corpo. Usar `problem+json` e reqId sem conteúdo interno em erro/log. Arquivos privados, cache por identidade/Conta e revogação real. Sem migração automática destrutiva: prévia de correspondência, contagens, segunda execução idempotente e reversão lógica por lote quando houver conversão.

### Validação técnica e término

Fixtures locais preservam histórico, IDs e decisões. Demonstrar CT-027 (segurança transversal) e todos AC-1, AC-2, AC-3, AC-4, AC-5, AC-6; matriz de evidência inclui comando e resultado. Revisão adversarial antes de PASS; CI com db-tests obrigatório na futura implementação. Homologação financeira exige reconciliação de saldos e de origens; não autoriza emissão real.

## Complexity Tracking

Sem exceção. Reusar contratos existentes antes de ampliar interface; não criar terceiro modelo concorrente.

