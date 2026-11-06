# Implementation Plan: E01-S178 — Levantamentos de planilha/Auvo e aprovação PCM em staging

**Branch de documentação:** `codex/handoff-plano-manutencao` | **Date:** 2026-10-26 | **Spec:** [spec.md](spec.md)
**Status:** design especificado; nenhuma implementação autorizada nesta sessão.

## Summary

criar recepção versionada em staging para arquivo/Auvo/futuro Campo com evidências privadas e preview de diferenças/erros; aprovar por linha/lote com controle de versão, validação de hierarquia/matches e incorporação transacional com reversão lógica controlada. Aproveitar base indicada abaixo antes de criar componente/adapters novos.

## Technical Context

TypeScript/React 19/Vite, Tailwind e packages/ui; Postgres/Supabase, Edge Functions Deno, TanStack Query e Zod existentes. Domain puro; application coordena, infrastructure concentra I/O. Testes Vitest, pgTAP para RPC/RLS e Playwright nas jornadas críticas. Web autenticada, listas paginadas por Cliente e período; não carregar histórico inteiro nem N+1. Medir consultas do piloto antes de índice adicional; não criar abstração ou serviço externo novo.

Dependências: E01-S176, E01-S177, E01-S170. Não condicionar teste de unidade ao ambiente real. Migração/contrato real são gates, fixtures não os comprovam.

## Constitution Check

Pré e pós-design: desenho exige RLS enable+FORCE, schemas por domínio, pgTAP permitido/negado e escopo Cliente, autorização por ação no servidor e audit append-only. Secrets/Vault servidor, HMAC constante para webhook, JWT/rate-limit/Zod/CORS na borda. Mudança aditiva, sem editar migration aplicada. Dinheiro em centavos/request_id único onde aplicável. TanStack Query em superfícies tocadas. Sem exceção constitucional proposta; verificação operacional está nas tasks futuras.

## Phase 0 — Research and Reuse

- `specs/E01-S161-importacao-excel-estrutura/spec.md`
- `apps/web/src/features/pcm/pages/EstruturaClientePage.tsx`
- `supabase/functions/_shared/auvo/webhook-dispatch.ts`

Ler [research.md](research.md), [contratos compartilhados](../../docs/planejamento/plano-manutencao/contratos-programa.md) e ADRs [0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md). Revalidar os caminhos contra HEAD ao iniciar; são referências de reuso, não autorização para reescrever seu conteúdo inteiro.

## Phase 1 — Design and Contracts

### Project Structure

- `apps/web/src/features/pcm/domain/levantamentos.ts`: regras/transições puras; teste adjacente por US.
- `apps/web/src/features/pcm/application/levantamentos.ts` e `levantamentos-gateway.ts`: comandos e fronteira.
- `apps/web/src/features/pcm/application/levantamentos-queries.ts`: query-key factory inclui Cliente/filtro/versão, cancelamento e invalidação dos consumidores global/360.
- `apps/web/src/features/pcm/infrastructure/supabase-levantamentos-adapter.ts`: RPCs/leituras de dados, sem regra paralela.
- `apps/web/src/features/pcm/interfaces/levantamentos/Workspace.tsx`: superfície própria ou composição sobre componentes existentes listados; packages/ui e estados/foco/teclado.
- `supabase/tests/E01-S178_levantamentos.test.sql`: testes de integridade, autorização positiva/negativa, concorrência e idempotência.
- `apps/web/e2e/levantamentos.spec.ts`: jornada crítica com dois Clientes e dependências em fixtures.

Esses caminhos novos são destinos planejados, não arquivos já implementados. Manter integrações em componentes/pages existentes onde já forem consumidores. Não mover arquitetura inteira para atender a esta story.

### Data and Transaction Boundary

Lote levantamento guarda origem/arquivo/hash/chave externa, revisão, Cliente e estado; linha contém tipo, código informado, atributos, referências por chave temporária, match sugerido e decisão. Evidências por linha usam Storage privado com origem. Aprovação resolve códigos definitivos pelo serviço E01-S177. Estados recebido/em conferência/pendente/aprovado parcial/aprovado/rejeitado com trilha e dependências de linha.

Ver [data-model.md](data-model.md) e [commands.md](contracts/commands.md). No começo da implementação alocar próxima migration real conforme db/README.md; nome `NNNN_E01-S178_levantamentos.sql` é convenção, não número reservado. Mudanças de regras herdadas usam expand/compatibilidade/backfill/verificação antes de retirar restrições. Story sem novo dado persistido reutiliza schema da dependência e altera apenas consulta/RPC necessária, sem tabela artificial.

### Contract and UI

receber_levantamento, simular_importacao_estrutura, decidir_linhas_levantamento, aprovar_lote_levantamento; contrato de recepção aceita origem planilha/Auvo/futuro Campo, chaves estáveis, entidades tipadas e evidências; não aceita texto inferido como cadastro final.

Servidor valida requestId, expectedRevision, sessão/escopo e payload. Mudança + auditoria + intenção externa na mesma transação. Integração cross-feature passa DTO em packages/shared existente, não import de feature. UI reutiliza navegação/detalhes do Cliente360 e módulos globais, com mesmo gateway e query keys. Atualização só invalida após sucesso; erro mantém edição/preview.

### Migration and Recovery

Inventariar contagens/referências legadas no ambiente de teste; mapear explicitamente novo vínculo. Não inferir execução de X, não recriar registro externo por ausência de mapping e não apagar histórico. Se algoritmo/contrato real divergir, registrar SPEC_DEVIATION e nova ADR antes de ampliar efeito; os ADRs anteriores permanecem preservados.

## Validation and Rollout

Por US: teste falho, domínio/transação, adapter, UI, teste de integração. Rodar quickstart com dois Clientes. CT relacionados: CT-030. Cada um de AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 precisa evidência, não só checkbox.
Futura implementação exige testes focados, `pnpm run eval:spec` (ver limitação no guia Terra), `pnpm run ci:local`, CI com db-tests não pulado e revisão adversarial antes de PASS arquitetural. Após código, graphify update. Só humano/@devops faz push/PR/deploy; Fabrício libera integração real. Nesta entrega não executar esse rollout.

## Complexity Tracking

Sem exceção à constituição. Construir aplicativo Copiloto Técnico, offline ou perfil técnico SO; interpretar automaticamente prosa ambígua; escrever cadastro definitivo na recepção.
