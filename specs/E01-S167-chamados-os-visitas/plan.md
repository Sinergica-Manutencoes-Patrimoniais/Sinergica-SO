# Implementation Plan: E01-S167 — Chamado 1:N OS, continuidade e encerramento integral

**Branch de documentação:** `codex/handoff-plano-manutencao` | **Date:** 2026-10-26 | **Spec:** [spec.md](spec.md)
**Status:** design especificado; nenhuma implementação autorizada nesta sessão.

## Summary

trocar conversão única por criação N:1 idempotente, referência OS única e read-model de Chamado com várias OS sem cards duplicados; registrar escopo resolvido/restante, continuação com validação PCM, aptidão calculada e encerramento explícito com retorno de escopo. Aproveitar base indicada abaixo antes de criar componente/adapters novos.

## Technical Context

TypeScript/React 19/Vite, Tailwind e packages/ui; Postgres/Supabase, Edge Functions Deno, TanStack Query e Zod existentes. Domain puro; application coordena, infrastructure concentra I/O. Testes Vitest, pgTAP para RPC/RLS e Playwright nas jornadas críticas. Web autenticada, listas paginadas por Cliente e período; não carregar histórico inteiro nem N+1. Medir consultas do piloto antes de índice adicional; não criar abstração ou serviço externo novo.

Dependências: E01-S170. Não condicionar teste de unidade ao ambiente real. Migração/contrato real são gates, fixtures não os comprovam.

## Constitution Check

Pré e pós-design: desenho exige RLS enable+FORCE, schemas por domínio, pgTAP permitido/negado e escopo Cliente, autorização por ação no servidor e audit append-only. Secrets/Vault servidor, HMAC constante para webhook, JWT/rate-limit/Zod/CORS na borda. Mudança aditiva, sem editar migration aplicada. Dinheiro em centavos/request_id único onde aplicável. TanStack Query em superfícies tocadas. Sem exceção constitucional proposta; verificação operacional está nas tasks futuras.

## Phase 0 — Research and Reuse

- `apps/web/src/features/pcm/application/chamados.ts`
- `apps/web/src/features/pcm/infrastructure/supabase-chamados-adapter.ts`
- `apps/web/src/features/pcm/components/ChamadoPainel.tsx`
- `supabase/migrations/0171_E01-S129_uma_os_por_chamado.sql`
- `supabase/migrations/0151_E01-S99_chamado_id_unico.sql`
- `supabase/migrations/0209_E01-S151_backlog_sem_chamado.sql`

Ler [research.md](research.md), [contratos compartilhados](../../docs/planejamento/plano-manutencao/contratos-programa.md) e ADRs [0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md). Revalidar os caminhos contra HEAD ao iniciar; são referências de reuso, não autorização para reescrever seu conteúdo inteiro.

## Phase 1 — Design and Contracts

### Project Structure

- `apps/web/src/features/pcm/domain/chamados-os.ts`: regras/transições puras; teste adjacente por US.
- `apps/web/src/features/pcm/application/chamados-os.ts` e `chamados-os-gateway.ts`: comandos e fronteira.
- `apps/web/src/features/pcm/application/chamados-os-queries.ts`: query-key factory inclui Cliente/filtro/versão, cancelamento e invalidação dos consumidores global/360.
- `apps/web/src/features/pcm/infrastructure/supabase-chamados-os-adapter.ts`: RPCs/leituras de dados, sem regra paralela.
- `apps/web/src/features/pcm/interfaces/chamados-os/Workspace.tsx`: superfície própria ou composição sobre componentes existentes listados; packages/ui e estados/foco/teclado.
- `supabase/tests/E01-S167_chamados_os.test.sql`: testes de integridade, autorização positiva/negativa, concorrência e idempotência.
- `apps/web/e2e/chamados-os.spec.ts`: jornada crítica com dois Clientes e dependências em fixtures.

Esses caminhos novos são destinos planejados, não arquivos já implementados. Manter integrações em componentes/pages existentes onde já forem consumidores. Não mover arquitetura inteira para atender a esta story.

### Data and Transaction Boundary

pcm.chamados mantém necessidade e estado gerencial; pcm.ordens_servico.chamado_id é canônico N:1. Composição de escopo contém parcelas atendidas/restantes e referências de origem. OS de continuação referencia antecessora e escopo/esforço restante. UUID e números legados preservados; OS novas recebem referência pública única distinta da referência do Chamado (sufixo estável), sem colisão do unique numero. Vínculo singular legado é somente leitura compatível.

Ver [data-model.md](data-model.md) e [commands.md](contracts/commands.md). No começo da implementação alocar próxima migration real conforme db/README.md; nome `NNNN_E01-S167_chamados_os.sql` é convenção, não número reservado. Mudanças de regras herdadas usam expand/compatibilidade/backfill/verificação antes de retirar restrições. Story sem novo dado persistido reutiliza schema da dependência e altera apenas consulta/RPC necessária, sem tabela artificial.

### Contract and UI

criar_os_chamado, criar_continuacao_os, validar_os, indicar_aptidao_chamado, encerrar_chamado, suspender_chamado; todos com revision e requestId. Fechar OS jamais executa encerrar_chamado implicitamente.

Servidor valida requestId, expectedRevision, sessão/escopo e payload. Mudança + auditoria + intenção externa na mesma transação. Integração cross-feature passa DTO em packages/shared existente, não import de feature. UI reutiliza navegação/detalhes do Cliente360 e módulos globais, com mesmo gateway e query keys. Atualização só invalida após sucesso; erro mantém edição/preview.

### Migration and Recovery

Revisar explicitamente `uq_ordens_servico_chamado` (0171), `idx_os_ocorrencia_preventiva` (0224), unique de `ordens_servico.numero` e trigger de sincronização de número (0151/0209). Remover índices singulares somente em migration nova após compatibilidade dos escritores/leitores. Não permitir três OS com o mesmo numero unique; preservar números antigos e reservar referência pública única por OS nova. O vínculo Chamado.ordem_servico_id fica legado de leitura, não fonte de cardinalidade.

Inventariar contagens/referências legadas no ambiente de teste; mapear explicitamente novo vínculo. Não inferir execução de X, não recriar registro externo por ausência de mapping e não apagar histórico. Se algoritmo/contrato real divergir, registrar SPEC_DEVIATION e nova ADR antes de ampliar efeito; os ADRs anteriores permanecem preservados.

## Validation and Rollout

Por US: teste falho, domínio/transação, adapter, UI, teste de integração. Rodar quickstart com dois Clientes. CT relacionados: CT-001, CT-002, CT-019. Cada um de AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 precisa evidência, não só checkbox.
Futura implementação exige testes focados, `pnpm run eval:spec` (ver limitação no guia Terra), `pnpm run ci:local`, CI com db-tests não pulado e revisão adversarial antes de PASS arquitetural. Após código, graphify update. Só humano/@devops faz push/PR/deploy; Fabrício libera integração real. Nesta entrega não executar esse rollout.

## Complexity Tracking

Sem exceção à constituição. Envio Auvo; Visita (E01-S171); criar Backlog como OS; renumerar legado.
