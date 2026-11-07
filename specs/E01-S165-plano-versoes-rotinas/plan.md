# Implementation Plan: E01-S165 — Plano multialvo, versões de Rotina e questionários referenciados

**Branch de documentação:** `codex/handoff-plano-manutencao` | **Date:** 2026-10-26 | **Spec:** [spec.md](spec.md)
**Status:** implementação e verificação integrada concluídas na branch, incluindo aplicação das migrations candidatas, 183 assertions pgTAP e E2E visual isolado (run 42279514625). CI completa com db-tests, revisão formal e homologação permanecem em T016. Não declarar PASS.

## Summary

validar escopo multialvo do Plano e alvo exclusivo por versão de Rotina, rascunho, instrução/checklist obrigatório e tempo pendente; aprovar por capacidade atual, versionar e congelar Rotinas/questionário aplicado, preservar histórico e produzir prévia de revisão/retirada/suspensão. Aproveitar base indicada abaixo antes de criar componente/adapters novos.

## Technical Context

TypeScript/React 19/Vite, Tailwind e packages/ui; Postgres/Supabase, Edge Functions Deno, TanStack Query e Zod existentes. Domain puro; application coordena, infrastructure concentra I/O. Testes Vitest, pgTAP para RPC/RLS e Playwright nas jornadas críticas. Web autenticada, listas paginadas por Cliente e período; não carregar histórico inteiro nem N+1. Medir consultas do piloto antes de índice adicional; não criar abstração ou serviço externo novo.

Dependências: E01-S170, E01-S176. Não condicionar teste de unidade ao ambiente real. Migração/contrato real são gates, fixtures não os comprovam.

## Constitution Check

Pré e pós-design: desenho exige RLS enable+FORCE, schemas por domínio, pgTAP permitido/negado e escopo Cliente, autorização por ação no servidor e audit append-only. Secrets/Vault servidor, HMAC constante para webhook, JWT/rate-limit/Zod/CORS na borda. Mudança aditiva, sem editar migration aplicada. Dinheiro em centavos/request_id único onde aplicável. TanStack Query em superfícies tocadas. Sem exceção constitucional proposta; verificação operacional está nas tasks futuras.

## Phase 0 — Research and Reuse

- `apps/web/src/features/pcm/domain/preventivas.ts`
- `apps/web/src/features/pcm/application/preventivas-gateway.ts`
- `apps/web/src/features/pcm/infrastructure/supabase-preventivas-adapter.ts`
- `apps/web/src/features/pcm/components/PreventivasWorkspace.tsx`
- `supabase/migrations/0224_E01-S53_preventivas_pcm.sql`

Ler [research.md](research.md), [contratos compartilhados](../../docs/planejamento/plano-manutencao/contratos-programa.md) e ADRs [0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md). Revalidar os caminhos contra HEAD ao iniciar; são referências de reuso, não autorização para reescrever seu conteúdo inteiro.

## Phase 1 — Design and Contracts

### Project Structure

- `apps/web/src/features/pcm/domain/plano-manutencao.ts`: regras/transições puras; teste adjacente por US.
- `apps/web/src/features/pcm/application/plano-manutencao.ts` e `plano-manutencao-gateway.ts`: comandos e fronteira.
- `apps/web/src/features/pcm/application/plano-manutencao-queries.ts`: query-key factory inclui Cliente/filtro/versão, cancelamento e invalidação dos consumidores global/360.
- `apps/web/src/features/pcm/infrastructure/supabase-plano-manutencao-adapter.ts`: RPCs/leituras de dados, sem regra paralela.
- `apps/web/src/features/pcm/interfaces/plano-manutencao/Workspace.tsx`: superfície própria ou composição sobre componentes existentes listados; packages/ui e estados/foco/teclado.
- `supabase/tests/E01-S165_plano_manutencao.test.sql`: testes de integridade, autorização positiva/negativa, concorrência e idempotência.
- `apps/web/e2e/plano-manutencao.spec.ts`: jornada crítica com dois Clientes e dependências em fixtures.

Esses caminhos novos são destinos planejados, não arquivos já implementados. Manter integrações em componentes/pages existentes onde já forem consumidores. Não mover arquitetura inteira para atender a esta story.

### Data and Transaction Boundary

pcm.planos_manutencao (identidade, cliente_id, proprietário, estado, versão vigente); pcm.plano_versoes (plano_id, número, vigência início/fim, aprovação, conteúdo congelado); pcm.rotinas_manutencao (identidade lógica, versão, alvo_tipo, alvo_id, modo, âncora, intervalo inteiro positivo, unidade dias/semanas/meses/anos, tolerância antes/depois inteiras não negativas com default 0, questionário ID externo e versão/snapshot de referência). Plano contém várias Rotinas; cada versão de Rotina possui exatamente um alvo do mesmo Cliente. Escopo Manter/Retirar exige motivo e vigência. Modelo aplicado por cópia identificada não altera planos existentes.

Ver [data-model.md](data-model.md) e [commands.md](contracts/commands.md). Decisão de versionamento imutável: [ADR-1679](../../docs/adr/1679-versionamento-revisao-plano-imutavel.md); coordenação do gerador legado: [ADR-1680](../../docs/adr/1680-guard-gerador-legado-integrado-plano.md); recibo completo: [ADR-1681](../../docs/adr/1681-recibo-completo-reconciliacao-revisao-plano.md). No começo da implementação alocar próxima migration real conforme db/README.md; nome `NNNN_E01-S165_plano_manutencao.sql` é convenção, não número reservado. Mudanças de regras herdadas usam expand/compatibilidade/backfill/verificação antes de retirar restrições. Story sem novo dado persistido reutiliza schema da dependência e altera apenas consulta/RPC necessária, sem tabela artificial.

### Contract and UI

salvar_plano_rascunho, copiar_rotina_modelo, submeter_plano, aprovar_versao_plano, criar_versao_rotina; entrada planoId/versão/escopos/rotinas e expectedRevision; saída versão e prévia de impactos sem materialização operacional.

Servidor valida requestId, expectedRevision, sessão/escopo e payload. Mudança + auditoria + intenção externa na mesma transação. Integração cross-feature passa DTO em packages/shared existente, não import de feature. UI reutiliza navegação/detalhes do Cliente360 e módulos globais, com mesmo gateway e query keys. Atualização só invalida após sucesso; erro mantém edição/preview.

### Migration and Recovery

Inventariar contagens/referências legadas no ambiente de teste; mapear explicitamente novo vínculo. Não inferir execução de X, não recriar registro externo por ausência de mapping e não apagar histórico. Se algoritmo/contrato real divergir, registrar SPEC_DEVIATION e nova ADR antes de ampliar efeito; os ADRs anteriores permanecem preservados.

## Validation and Rollout

Por US: teste falho, domínio/transação, adapter, UI, teste de integração. Rodar quickstart com dois Clientes. CT relacionados: testes próprios de Plano e recorrência do programa. Cada um de AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 precisa evidência, não só checkbox.
Futura implementação exige testes focados, `pnpm run eval:spec` (ver limitação no guia Terra), `pnpm run ci:local`, CI com db-tests não pulado e revisão adversarial antes de PASS arquitetural. Após código, graphify update. Só humano/@devops faz push/PR/deploy; Fabrício libera integração real. Nesta entrega não executar esse rollout.

## Complexity Tracking

Sem exceção à constituição. Biblioteca/editoração/publicação de questionários própria e import/export Auvo sem contrato comprovado; geração externa; Copiloto completo.
