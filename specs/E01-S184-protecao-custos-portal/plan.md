# Implementation Plan: E01-S184 — Proteção de custos em respostas e documentos do Portal

**Branch**: `codex/handoff-plano-manutencao` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)
**Status**: Especificada — implementação não iniciada

## Summary

Remover composição interna de todos os caminhos acessíveis ao Cliente e separar documento público do snapshot privado preservado.

## Technical Context

- TypeScript, React 19, Supabase/PostgreSQL, TanStack Query e Zod existentes; sem dependência nova prevista.
- Testes: Vitest (domain/application), pgTAP em Supabase local (RPC/RLS/concorrência), Playwright para jornada crítica.
- Plataforma: web; listas paginadas, consultas agregadas sem N+1; dinheiro inteiro em centavos.
- Dependências: Independente; correção crítica prévia à E01-S181/E01-S183.
- Contrato global: [contratos-programa.md](../../docs/planejamento/plano-manutencao/contratos-programa.md).
- Decisões: [ADR-0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [ADR-0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [ADR-0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md); ler os três antes de implementar. Não alterar ADR anterior silenciosamente.

## Constitution Check

Pré e pós-design: desenho compatível com migrations aditivas, FORCE RLS, pgTAP positivo/negativo, audit append-only, segredo servidor, autorização por ação no servidor e DDD sem import entre features. TanStack Query obrigatório nas superfícies tocadas. Dinheiro em centavos, request_id único e conflitos de revisão explícitos. Nenhuma exceção constitucional prevista; verificação é tarefa futura, não resultado já executado.

## Phase 0 — Research

- Base verificada: `supabase/migrations/0188_E03-S06_portal_propostas.sql`.
- Base verificada: `supabase/migrations/0202_E03-S12_view_portal_orcamentos.sql`.
- Base verificada: `supabase/migrations/0144_E09-S09_portal_orcamentos.sql`.
- Base verificada: `apps/web/src/features/comercial/domain/proposta-pdf.ts`.
- Base verificada: `apps/web/src/features/comercial/domain/proposta-pdf.test.ts`.
- Base verificada: `apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts`.

Bug comprovado: 0188 entrega v.payload inteiro; proposta-pdf.ts usa custo_unitario_centavos. 0202 usa security_invoker mas 0144 permite cliente consultar tabela com itens JSON livre. Corrigir ambos os percursos via migrations aditivas alterando view/RPC e grants/policies; manter interno via leitura autorizada. Como independente de E01-S170, correção inicial restringe custos ao administrador existente; posterior matriz granular amplia somente com autorização. PDF público recebe contrato seguro de packages, sem import de feature Comercial pelo Portal.

## Phase 1 — Design

### Estrutura e responsabilidades

- `apps/web/src/features/area-cliente/domain/protecao-custos-portal.ts`: invariantes puras e transições, sem I/O/framework.
- `apps/web/src/features/area-cliente/application/protecao-custos-portal.ts` e `apps/web/src/features/area-cliente/application/protecao-custos-portal-queries.ts`: casos de uso, gateway e Query Keys com invalidação/cancelamento.
- `apps/web/src/features/area-cliente/infrastructure/supabase-protecao-custos-portal-adapter.ts`: adaptação Supabase; respeitar adapter existente quando for a menor mudança.
- `apps/web/src/features/area-cliente/infrastructure/supabase-portal-adapter.ts`: interface operacional, carregando/vazio/erro/sucesso e teclado; custos restritos no servidor.
- `packages/shared/src/protecao-custos-portal-contracts.ts`: DTO intercontexto público/servidor sem import entre features.
- `supabase/tests/E01-S184_protecao_custos_portal_us1.test.sql`, `E01-S184_protecao_custos_portal_us2.test.sql` e `E01-S184_protecao_custos_portal_us3.test.sql`: autorização, idempotência e vínculos.
- `apps/web/e2e/protecao-custos-portal.spec.ts`: jornada crítica isolada sem serviço externo real.

### Formatação PDF e reuso explícito

Corrigir `apps/web/src/features/comercial/domain/proposta-pdf.ts` e seus testes: formatação pública não pode receber snapshot privado nem calcular preço por custo_unitario_centavos. Contrato público compartilhado é consumido pelo Portal, sem import da feature Comercial. Manter formatação interna sob autorização; localizar e adaptar todos os chamadores antes de retirar assinatura antiga.

### Persistência e transação

Ver [data-model.md](data-model.md) e [contracts/commands.md](contracts/commands.md). Alocar número da migration somente na implementação consultando `db/README.md` e maior sequência aplicada. Criar migration aditiva em `supabase/migrations/` com ID E01-S184; nunca editar as bases citadas. Constraint, permissões, evento auditável e efeito do comando pertencem à mesma transação; request_id guarda resposta anterior e rejeita payload divergente.

### Segurança e compatibilidade

Políticas permitidas e negadas por papel/Conta/ação; não confiar em valor, Cliente ou papel enviados no corpo. Usar `problem+json` e reqId sem conteúdo interno em erro/log. Arquivos privados, cache por identidade/Conta e revogação real. Sem migração automática destrutiva: prévia de correspondência, contagens, segunda execução idempotente e reversão lógica por lote quando houver conversão.

### Validação técnica e término

Fixtures locais preservam histórico, IDs e decisões. Demonstrar CT-024 e CT-027 e todos AC-1, AC-2, AC-3, AC-4, AC-5, AC-6; matriz de evidência inclui comando e resultado. Revisão adversarial antes de PASS; CI com db-tests obrigatório na futura implementação. Homologação financeira exige reconciliação de saldos e de origens; não autoriza emissão real.

## Complexity Tracking

Sem exceção. Reusar contratos existentes antes de ampliar interface; não criar terceiro modelo concorrente.

