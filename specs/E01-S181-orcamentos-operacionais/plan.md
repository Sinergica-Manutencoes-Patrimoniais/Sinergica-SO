# Implementation Plan: E01-S181 — Orçamento operacional canônico no Comercial

**Branch**: `codex/handoff-plano-manutencao` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)
**Status**: Especificada — implementação não iniciada

## Summary

Reutilizar propostas/versões do Comercial para fornecimento e serviço operacional, vincular OS/lista e preservar compatibilidade com orçamentos legados do PCM.

## Technical Context

- TypeScript, React 19, Supabase/PostgreSQL, TanStack Query e Zod existentes; sem dependência nova prevista.
- Testes: Vitest (domain/application), pgTAP em Supabase local (RPC/RLS/concorrência), Playwright para jornada crítica.
- Plataforma: web; listas paginadas, consultas agregadas sem N+1; dinheiro inteiro em centavos.
- Dependências: E01-S179 (materiais), E01-S170 (autorização) e E01-S184 (proteção de custos).
- Contrato global: [contratos-programa.md](../../docs/planejamento/plano-manutencao/contratos-programa.md).
- Decisões: [ADR-0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [ADR-0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [ADR-0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md); ler os três antes de implementar. Não alterar ADR anterior silenciosamente.

## Constitution Check

Pré e pós-design: desenho compatível com migrations aditivas, FORCE RLS, pgTAP positivo/negativo, audit append-only, segredo servidor, autorização por ação no servidor e DDD sem import entre features. TanStack Query obrigatório nas superfícies tocadas. Dinheiro em centavos, request_id único e conflitos de revisão explícitos. Nenhuma exceção constitucional prevista; verificação é tarefa futura, não resultado já executado.

## Phase 0 — Research

- Base verificada: `supabase/migrations/0182_E03-S04_propostas.sql`.
- Base verificada: `supabase/migrations/0184_E03-S04_rpcs_proposta.sql`.
- Base verificada: `supabase/migrations/0144_E09-S09_portal_orcamentos.sql`.
- Base verificada: `supabase/migrations/0125_E04-S12_dre_orcamento.sql`.
- Base verificada: `apps/web/src/features/comercial/application/proposta.ts`.
- Base verificada: `apps/web/src/features/comercial/infrastructure/supabase-proposta-adapter.ts`.

Comercial é canônico porque já oferece composição, snapshots e decisões. Adaptar oportunidade_id obrigatório com origem operacional explícita em migration aditiva e regra XOR validada, mantendo propostas comerciais existentes. Não usar financeiro.orcamentos nem terceira tabela de orçamento PCM. Criar API pública sanitizada conforme E01-S184. Compatibilidade com portal_decidir_orcamento deve impedir OS duplicada.

## Phase 1 — Design

### Estrutura e responsabilidades

- `apps/web/src/features/comercial/domain/orcamento-operacional.ts`: invariantes puras e transições, sem I/O/framework.
- `apps/web/src/features/comercial/application/orcamento-operacional.ts` e `apps/web/src/features/comercial/application/orcamento-operacional-queries.ts`: casos de uso, gateway e Query Keys com invalidação/cancelamento.
- `apps/web/src/features/comercial/infrastructure/supabase-orcamento-operacional-adapter.ts`: adaptação Supabase; respeitar adapter existente quando for a menor mudança.
- `apps/web/src/features/comercial/pages/OrcamentoOperacionalPage.tsx`: interface operacional, carregando/vazio/erro/sucesso e teclado; custos restritos no servidor.
- `packages/shared/src/orcamento-operacional-contracts.ts`: DTO intercontexto público/servidor sem import entre features.
- `supabase/tests/E01-S181_orcamentos_operacionais_us1.test.sql`, `E01-S181_orcamentos_operacionais_us2.test.sql` e `E01-S181_orcamentos_operacionais_us3.test.sql`: autorização, idempotência e vínculos.
- `apps/web/e2e/orcamentos-operacionais.spec.ts`: jornada crítica isolada sem serviço externo real.

### Reuso do fluxo Comercial

Evoluir `apps/web/src/features/comercial/application/proposta.ts`, `application/proposta-gateway.ts`, `application/proposta-queries.ts` e `infrastructure/supabase-proposta-adapter.ts`; o caso de uso operacional adapta origem/estados e reutiliza esses contratos, sem duplicar motor de preço, snapshots ou persistência. Ajustar RPCs por migration nova, não a 0184 aplicada. A interface operacional pode ser nova, mas ambas as origens gravam a mesma proposta/versão.

### Persistência e transação

Ver [data-model.md](data-model.md) e [contracts/commands.md](contracts/commands.md). Alocar número da migration somente na implementação consultando `db/README.md` e maior sequência aplicada. Criar migration aditiva em `supabase/migrations/` com ID E01-S181; nunca editar as bases citadas. Constraint, permissões, evento auditável e efeito do comando pertencem à mesma transação; request_id guarda resposta anterior e rejeita payload divergente.

### Segurança e compatibilidade

Políticas permitidas e negadas por papel/Conta/ação; não confiar em valor, Cliente ou papel enviados no corpo. Usar `problem+json` e reqId sem conteúdo interno em erro/log. Arquivos privados, cache por identidade/Conta e revogação real. Sem migração automática destrutiva: prévia de correspondência, contagens, segunda execução idempotente e reversão lógica por lote quando houver conversão.

### Validação técnica e término

Fixtures locais preservam histórico, IDs e decisões. Demonstrar CT-024 e CT-025 e todos AC-1, AC-2, AC-3, AC-4, AC-5, AC-6; matriz de evidência inclui comando e resultado. Revisão adversarial antes de PASS; CI com db-tests obrigatório na futura implementação. Homologação financeira exige reconciliação de saldos e de origens; não autoriza emissão real.

## Complexity Tracking

Sem exceção. Reusar contratos existentes antes de ampliar interface; não criar terceiro modelo concorrente.

