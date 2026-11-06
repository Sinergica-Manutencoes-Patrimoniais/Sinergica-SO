# Implementation Plan: E01-S170 — Permissões por ação e governança configurável do programa

**Branch de documentação:** `codex/handoff-plano-manutencao` | **Date:** 2026-10-26 | **Spec:** [spec.md](spec.md)
**Status:** implementação e validação pgTAP integrada (12 assertions) concluídas; suíte web completa também passou. CI completa, E2E visual, revisão formal e homologação continuam pendentes em T016; não declarar PASS.

## Summary

compor perfis/grupos existentes com capacidades e escopos, checar servidor com concessões atuais e refletir UI sem bypass por token antigo; aplicar gestão individual de Plano e autoaprovação aprovada, validação específica e trilha append-only de concessão/decisão. Aproveitar base indicada abaixo antes de criar componente/adapters novos.

## Technical Context

TypeScript/React 19/Vite, Tailwind e packages/ui; Postgres/Supabase, Edge Functions Deno, TanStack Query e Zod existentes. Domain puro; application coordena, infrastructure concentra I/O. Testes Vitest, pgTAP para RPC/RLS e Playwright nas jornadas críticas. Web autenticada, listas paginadas por Cliente e período; não carregar histórico inteiro nem N+1. Medir consultas do piloto antes de índice adicional; não criar abstração ou serviço externo novo.

Dependências: base existente; fatia iniciável isoladamente. Não condicionar teste de unidade ao ambiente real. Migração/contrato real são gates, fixtures não os comprovam.

## Constitution Check

Pré e pós-design: desenho exige RLS enable+FORCE, schemas por domínio, pgTAP permitido/negado e escopo Cliente, autorização por ação no servidor e audit append-only. Secrets/Vault servidor, HMAC constante para webhook, JWT/rate-limit/Zod/CORS na borda. Mudança aditiva, sem editar migration aplicada. Dinheiro em centavos/request_id único onde aplicável. TanStack Query em superfícies tocadas. Sem exceção constitucional proposta; verificação operacional está nas tasks futuras.

## Phase 0 — Research and Reuse

- `apps/web/src/features/config/domain/permissao.ts`
- `apps/web/src/features/config/application/definir-permissao-usuario.ts`
- `apps/web/src/features/config/application/editar-grupo.ts`
- `apps/web/src/app/permissoes-context.tsx`
- `supabase/migrations/0006_E00-S09_grupos_permissoes_modulo.sql`

Ler [research.md](research.md), [contratos compartilhados](../../docs/planejamento/plano-manutencao/contratos-programa.md) e ADRs [0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md). Revalidar os caminhos contra HEAD ao iniciar; são referências de reuso, não autorização para reescrever seu conteúdo inteiro.

## Phase 1 — Design and Contracts

### Project Structure

- `apps/web/src/features/pcm/domain/capacidades-sso.ts`: regras/transições puras; teste adjacente por US.
- `apps/web/src/features/pcm/application/capacidades-sso.ts` e `capacidades-sso-gateway.ts`: comandos e fronteira.
- `apps/web/src/features/pcm/application/capacidades-sso-queries.ts`: query-key factory inclui Cliente/filtro/versão, cancelamento e invalidação dos consumidores global/360.
- `apps/web/src/features/pcm/infrastructure/supabase-capacidades-sso-adapter.ts`: RPCs/leituras de dados, sem regra paralela.
- `apps/web/src/features/pcm/interfaces/capacidades-sso/Workspace.tsx`: superfície própria ou composição sobre componentes existentes listados; packages/ui e estados/foco/teclado.
- `supabase/tests/E01-S170_capacidades_sso.test.sql`: testes de integridade, autorização positiva/negativa, concorrência e idempotência.
- `apps/web/e2e/capacidades-sso.spec.ts`: jornada crítica com dois Clientes e dependências em fixtures.

Esses caminhos novos são destinos planejados, não arquivos já implementados. Manter integrações em componentes/pages existentes onde já forem consumidores. Não mover arquitetura inteira para atender a esta story.

### Data and Transaction Boundary

Concessão de capacidade vincula usuário/perfil, ação e escopo Cliente; perfis acumuláveis reutilizam grupos. Gestão de Plano tem concessão individual específica; política de autoaprovação permite criador quando possui concessão. Capacidade é checada com estado atual no servidor. Evento auditável append-only inclui motivo, ator, antes/depois e correlação. Técnico não ganha acesso SSO. O catálogo não migra permissões automaticamente: um superadmin já provisionado faz a concessão inicial explícita, preservando o default-deny.

Ver [data-model.md](data-model.md) e [commands.md](contracts/commands.md). A decisão de capacidade atual por ação e escopo, com auditoria append-only, está em [ADR-1676](../../docs/adr/1676-capacidades-sso-escopo-auditoria.md). No começo da implementação alocar próxima migration real conforme db/README.md; nome `NNNN_E01-S170_capacidades_sso.sql` é convenção, não número reservado. Mudanças de regras herdadas usam expand/compatibilidade/backfill/verificação antes de retirar restrições. Story sem novo dado persistido reutiliza schema da dependência e altera apenas consulta/RPC necessária, sem tabela artificial.

### Contract and UI

conceder_capacidade, revogar_capacidade, resolver_capacidades, autorizar_acao; ações catálogo: plano.gerir, visita.confirmar, execucao.validar, chamado.encerrar, cadastro.aprovar, codigo.substituir, material.gerir, custo.ler, orcamento.emitir, faturavel.efetivar, integracao.reconciliar.

Servidor valida requestId, expectedRevision, sessão/escopo e payload. Mudança + auditoria + intenção externa na mesma transação. Integração cross-feature passa DTO em packages/shared existente, não import de feature. UI reutiliza navegação/detalhes do Cliente360 e módulos globais, com mesmo gateway e query keys. Atualização só invalida após sucesso; erro mantém edição/preview.

### Migration and Recovery

Inventariar contagens/referências legadas no ambiente de teste; mapear explicitamente novo vínculo. Não inferir execução de X, não recriar registro externo por ausência de mapping e não apagar histórico. Se algoritmo/contrato real divergir, registrar SPEC_DEVIATION e nova ADR antes de ampliar efeito; os ADRs anteriores permanecem preservados.

## Validation and Rollout

Por US: teste falho, domínio/transação, adapter, UI, teste de integração. Rodar quickstart com dois Clientes. CT relacionados: CT-027. Cada um de AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 precisa evidência, não só checkbox.
Futura implementação exige testes focados, `pnpm run eval:spec` (ver limitação no guia Terra), `pnpm run ci:local`, CI com db-tests não pulado e revisão adversarial antes de PASS arquitetural. Após código, graphify update. Só humano/@devops faz push/PR/deploy; Fabrício libera integração real. Nesta entrega não executar esse rollout.

## Complexity Tracking

Sem exceção à constituição. Identidades hardcoded; criar login técnico SSO; considerar escrita genérica como aprovação/validação automática.
