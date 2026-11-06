# Implementation Plan: E01-S176 — Hierarquia técnica, Sistemas distribuídos e Grupos Quantitativos

**Branch de documentação:** `codex/handoff-plano-manutencao` | **Date:** 2026-10-26 | **Spec:** [spec.md](spec.md)
**Status:** implementação concluída; suíte web completa e pgTAP integrado (21 assertions combinadas) passaram. CI completa, E2E visual, revisão formal e homologação permanecem pendentes em T016.

## Summary

estender parent_item_id com invariantes servidor e criar Grupo Quantitativo por Local sem recriar cadastros; compor read-models de Local/Sistema/ativo 360 com contexto físico/funcional sem inferir histórico inexistente. Aproveitar base indicada abaixo antes de criar componente/adapters novos.

## Technical Context

TypeScript/React 19/Vite, Tailwind e packages/ui; Postgres/Supabase, Edge Functions Deno, TanStack Query e Zod existentes. Domain puro; application coordena, infrastructure concentra I/O. Testes Vitest, pgTAP para RPC/RLS e Playwright nas jornadas críticas. Web autenticada, listas paginadas por Cliente e período; não carregar histórico inteiro nem N+1. Medir consultas do piloto antes de índice adicional; não criar abstração ou serviço externo novo.

Dependências: E01-S170. Não condicionar teste de unidade ao ambiente real. Migração/contrato real são gates, fixtures não os comprovam.

## Constitution Check

Pré e pós-design: desenho exige RLS enable+FORCE, schemas por domínio, pgTAP permitido/negado e escopo Cliente, autorização por ação no servidor e audit append-only. Secrets/Vault servidor, HMAC constante para webhook, JWT/rate-limit/Zod/CORS na borda. Mudança aditiva, sem editar migration aplicada. Dinheiro em centavos/request_id único onde aplicável. TanStack Query em superfícies tocadas. Sem exceção constitucional proposta; verificação operacional está nas tasks futuras.

## Phase 0 — Research and Reuse

- `supabase/migrations/0095_E01-S76_hierarquia_localizacao_ativos.sql`
- `supabase/migrations/0216_E01-S154_sistema_itens_item_unico.sql`
- `apps/web/src/features/pcm/domain/equipamentos.ts`
- `apps/web/src/features/pcm/application/equipamentos.ts`
- `apps/web/src/features/pcm/components/ComposicaoSistema.tsx`
- `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx`

Ler [research.md](research.md), [contratos compartilhados](../../docs/planejamento/plano-manutencao/contratos-programa.md) e ADRs [0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md). Revalidar os caminhos contra HEAD ao iniciar; são referências de reuso, não autorização para reescrever seu conteúdo inteiro.

## Phase 1 — Design and Contracts

### Project Structure

- `apps/web/src/features/pcm/domain/estrutura-tecnica.ts`: regras/transições puras; teste adjacente por US.
- `apps/web/src/features/pcm/application/estrutura-tecnica.ts` e `estrutura-tecnica-gateway.ts`: comandos e fronteira.
- `apps/web/src/features/pcm/application/estrutura-tecnica-queries.ts`: query-key factory inclui Cliente/filtro/versão, cancelamento e invalidação dos consumidores global/360.
- `apps/web/src/features/pcm/infrastructure/supabase-estrutura-tecnica-adapter.ts`: RPCs/leituras de dados, sem regra paralela.
- A jornada é integrada em `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx`, usando `apps/web/src/features/pcm/interfaces/estrutura-tecnica/ComposicaoLocal.tsx`, `SistemasDistribuidos.tsx` e `DrawerDetalheSistema.tsx`; não existe um `Workspace.tsx` separado. Preservar packages/ui e estados/foco/teclado.
- `supabase/tests/E01-S176_estrutura_tecnica.test.sql`: testes de integridade, autorização positiva/negativa, concorrência e idempotência.
- `apps/web/e2e/estrutura-tecnica.spec.ts`: jornada crítica com dois Clientes e dependências em fixtures.

Esses caminhos novos são destinos planejados, não arquivos já implementados. Manter integrações em componentes/pages existentes onde já forem consumidores. Não mover arquitetura inteira para atender a esta story.

### Data and Transaction Boundary

Preservar pcm.areas/locais/equipamentos/sistemas/sistema_itens. parent_item_id é pai recursivo mesmo Cliente, sem ciclo nem autoparente; Componente continua em no máximo um Sistema vigente. Grupo Quantitativo identifica categoria/nome, Local, quantidade positiva e atributos, sem individualizar TAG por unidade. Sistema distribuído lista Locais dos membros e vínculos funcionais; mover membro não redefine identidade.

Ver [data-model.md](data-model.md) e [commands.md](contracts/commands.md). O vínculo de membros de Sistemas distribuídos com isolamento por Cliente está registrado em [ADR-1677](../../docs/adr/1677-vinculo-membro-sistema-escopo-cliente.md). No começo da implementação alocar próxima migration real conforme db/README.md; nome `NNNN_E01-S176_estrutura_tecnica.sql` é convenção, não número reservado. Mudanças de regras herdadas usam expand/compatibilidade/backfill/verificação antes de retirar restrições. Story sem novo dado persistido reutiliza schema da dependência e altera apenas consulta/RPC necessária, sem tabela artificial.

### Contract and UI

salvar_ativo_hierarquia, mover_ativo, salvar_grupo_quantitativo, vincular_membro_sistema; servidor valida ancestralidade e Cliente; resposta breadcrumb físico e árvore funcional.

Servidor valida requestId, expectedRevision, sessão/escopo e payload. Mudança + auditoria + intenção externa na mesma transação. Integração cross-feature passa DTO em packages/shared existente, não import de feature. UI reutiliza navegação/detalhes do Cliente360 e módulos globais, com mesmo gateway e query keys. Atualização só invalida após sucesso; erro mantém edição/preview.

### Migration and Recovery

Inventariar contagens/referências legadas no ambiente de teste; mapear explicitamente novo vínculo. Não inferir execução de X, não recriar registro externo por ausência de mapping e não apagar histórico. Se algoritmo/contrato real divergir, registrar SPEC_DEVIATION e nova ADR antes de ampliar efeito; os ADRs anteriores permanecem preservados.

## Validation and Rollout

Por US: teste falho, domínio/transação, adapter, UI, teste de integração. Rodar quickstart com dois Clientes. CT relacionados: CT-012, CT-013, CT-014. Cada um de AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 precisa evidência, não só checkbox.
Futura implementação exige testes focados, `pnpm run eval:spec` (ver limitação no guia Terra), `pnpm run ci:local`, CI com db-tests não pulado e revisão adversarial antes de PASS arquitetural. Após código, graphify update. Só humano/@devops faz push/PR/deploy; Fabrício libera integração real. Nesta entrega não executar esse rollout.

## Complexity Tracking

Sem exceção à constituição. Renomear tabela pcm.equipamentos; criar árvore física duplicada; forçar torre/pavimento como níveis rígidos; criar Equipment Auvo por luminária de Grupo.
