# Implementation Plan: E01-S183 — Portal operacional de materiais, orçamento e cobrança

**Branch**: `codex/handoff-plano-manutencao` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)
**Status**: Especificada — implementação não iniciada

## Summary

Cliente acompanha materiais, responsabilidade, orçamento/decisão, OS e cobrança pelo mesmo contexto com isolamento e dados públicos.

## Technical Context

- TypeScript, React 19, Supabase/PostgreSQL, TanStack Query e Zod existentes; sem dependência nova prevista.
- Testes: Vitest (domain/application), pgTAP em Supabase local (RPC/RLS/concorrência), Playwright para jornada crítica.
- Plataforma: web; listas paginadas, consultas agregadas sem N+1; dinheiro inteiro em centavos.
- Dependências: E01-S179, E01-S181, E01-S182, E01-S184 e E01-S170.
- Contrato global: [contratos-programa.md](../../docs/planejamento/plano-manutencao/contratos-programa.md).
- Decisões: [ADR-0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [ADR-0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [ADR-0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md); ler os três antes de implementar. Não alterar ADR anterior silenciosamente.

## Constitution Check

Pré e pós-design: desenho compatível com migrations aditivas, FORCE RLS, pgTAP positivo/negativo, audit append-only, segredo servidor, autorização por ação no servidor e DDD sem import entre features. TanStack Query obrigatório nas superfícies tocadas. Dinheiro em centavos, request_id único e conflitos de revisão explícitos. Nenhuma exceção constitucional prevista; verificação é tarefa futura, não resultado já executado.

## Phase 0 — Research

- Base verificada: `apps/web/src/features/area-cliente/application/portal-gateway.ts`.
- Base verificada: `apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts`.
- Base verificada: `supabase/migrations/0202_E03-S12_view_portal_orcamentos.sql`.
- Base verificada: `supabase/migrations/0145_E09-S10_portal_financeiro.sql`.

Reusar supabase-portal-adapter e portal-gateway, expandindo DTO público via packages e views/RPCs. Refatorar leituras tocadas para TanStack Query, query keys por Conta e identidade; revogação server-side por membership vigente. Segurança do payload/PDF é pré-requisito E01-S184.

## Phase 1 — Design

### Estrutura e responsabilidades

- `apps/web/src/features/area-cliente/domain/portal-operacional.ts`: invariantes puras e transições, sem I/O/framework.
- `apps/web/src/features/area-cliente/application/portal-operacional.ts` e `apps/web/src/features/area-cliente/application/portal-operacional-queries.ts`: casos de uso, gateway e Query Keys com invalidação/cancelamento.
- `apps/web/src/features/area-cliente/infrastructure/supabase-portal-operacional-adapter.ts`: adaptação Supabase; respeitar adapter existente quando for a menor mudança.
- `apps/web/src/features/area-cliente/pages/PortalOperacionalPage.tsx`: interface operacional, carregando/vazio/erro/sucesso e teclado; custos restritos no servidor.
- `packages/shared/src/portal-operacional-contracts.ts`: DTO intercontexto público/servidor sem import entre features.
- `supabase/tests/E01-S183_portal_operacional_us1.test.sql`, `E01-S183_portal_operacional_us2.test.sql` e `E01-S183_portal_operacional_us3.test.sql`: autorização, idempotência e vínculos.
- `apps/web/e2e/portal-operacional.spec.ts`: jornada crítica isolada sem serviço externo real.

### Persistência e transação

Ver [data-model.md](data-model.md) e [contracts/commands.md](contracts/commands.md). Alocar número da migration somente na implementação consultando `db/README.md` e maior sequência aplicada. Criar migration aditiva em `supabase/migrations/` com ID E01-S183; nunca editar as bases citadas. Constraint, permissões, evento auditável e efeito do comando pertencem à mesma transação; request_id guarda resposta anterior e rejeita payload divergente.

### Segurança e compatibilidade

Políticas permitidas e negadas por papel/Conta/ação; não confiar em valor, Cliente ou papel enviados no corpo. Usar `problem+json` e reqId sem conteúdo interno em erro/log. Arquivos privados, cache por identidade/Conta e revogação real. Sem migração automática destrutiva: prévia de correspondência, contagens, segunda execução idempotente e reversão lógica por lote quando houver conversão.

### Validação técnica e término

Fixtures locais preservam histórico, IDs e decisões. Demonstrar CT-027 e todos AC-1, AC-2, AC-3, AC-4, AC-5, AC-6; matriz de evidência inclui comando e resultado. Revisão adversarial antes de PASS; CI com db-tests obrigatório na futura implementação. Homologação financeira exige reconciliação de saldos e de origens; não autoriza emissão real.

## Complexity Tracking

Sem exceção. Reusar contratos existentes antes de ampliar interface; não criar terceiro modelo concorrente.

