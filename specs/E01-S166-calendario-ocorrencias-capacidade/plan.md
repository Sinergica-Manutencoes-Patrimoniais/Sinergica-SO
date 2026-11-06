# Implementation Plan: E01-S166 — Calendário contratual, recorrência por modo e ocorrências idempotentes

**Branch de documentação:** `codex/handoff-plano-manutencao` | **Date:** 2026-10-26 | **Spec:** [spec.md](spec.md)
**Status:** T001–T015 implementados; pgTAP integrado passou, inclusive o fluxo V2 com 501 visitas. T016 permanece aberto para medição de capacidade, E2E visual, CI completa, revisão formal e homologação; não declarar PASS.

## Summary

projetar frequência/dia/vigência e exceções por modo, preservar extras e reprogramações e apresentar impacto antes de efetivar mudança contratual; materializar transacionalmente ciclos estáveis, tratar decisão de vencidos/cancelamento e tolerâncias sem duplicação entre versões. Aproveitar base indicada abaixo antes de criar componente/adapters novos.

## Technical Context

TypeScript/React 19/Vite, Tailwind e packages/ui; Postgres/Supabase, Edge Functions Deno, TanStack Query e Zod existentes. Domain puro; application coordena, infrastructure concentra I/O. Testes Vitest, pgTAP para RPC/RLS e Playwright nas jornadas críticas. Web autenticada, listas paginadas por Cliente e período; não carregar histórico inteiro nem N+1. Medir consultas do piloto antes de índice adicional; não criar abstração ou serviço externo novo.

Dependências: E01-S165, E01-S171. Não condicionar teste de unidade ao ambiente real. Migração/contrato real são gates, fixtures não os comprovam.

## Constitution Check

Pré e pós-design: desenho exige RLS enable+FORCE, schemas por domínio, pgTAP permitido/negado e escopo Cliente, autorização por ação no servidor e audit append-only. Secrets/Vault servidor, HMAC constante para webhook, JWT/rate-limit/Zod/CORS na borda. Mudança aditiva, sem editar migration aplicada. Dinheiro em centavos/request_id único onde aplicável. TanStack Query em superfícies tocadas. Sem exceção constitucional proposta; verificação operacional está nas tasks futuras.

## Phase 0 — Research and Reuse

- `apps/web/src/features/pcm/domain/preventivas.ts`
- `supabase/migrations/0224_E01-S53_preventivas_pcm.sql`
- `apps/web/src/features/pcm/components/PreventivasCalendarioView.tsx`

Ler [research.md](research.md), [contratos compartilhados](../../docs/planejamento/plano-manutencao/contratos-programa.md) e ADRs [0026](../../docs/adr/0026-programa-sso-objetos-planejamento-execucao.md), [0027](../../docs/adr/0027-orcamento-canonico-e-faturamento-operacional.md), [0028](../../docs/adr/0028-identidade-alias-e-levantamentos-aprovados.md). Revalidar os caminhos contra HEAD ao iniciar; são referências de reuso, não autorização para reescrever seu conteúdo inteiro.

## Phase 1 — Design and Contracts

### Project Structure

Artefatos de implementação preparados no candidato:

- `apps/web/src/features/pcm/domain/calendario-contratual.ts`: projeção e regras puras, com testes adjacentes por US.
- `apps/web/src/features/pcm/application/calendario-contratual.ts` e `calendario-contratual-gateway.ts`: comandos e fronteira.
- `apps/web/src/features/pcm/application/calendario-contratual-queries.ts`: consultas paginadas, cancelamento e invalidação dos consumidores.
- `apps/web/src/features/pcm/infrastructure/supabase-calendario-contratual-adapter.ts`: RPCs/leituras de dados, sem regra paralela.
- `apps/web/src/features/pcm/interfaces/calendario-contratual/Workspace.tsx` e componentes associados: simulação, exceções, alterações vigentes e estados de interface.
- `supabase/migrations/1820_E01-S166_mudanca_dia_v2_fundacao.sql` e `1821_E01-S166_mudanca_dia_v2_rpc.sql`.
- `supabase/tests/E01-S166_mudanca_dia_v2_contract.test.sql` e `E01-S166_versoes_recorrencia_tolerancia.test.sql`.
- `apps/web/e2e/calendario-contratual.spec.ts` e fixture/configuração isoladas em `apps/web/e2e/s166-isolado/` e `apps/web/playwright.s166-isolado.config.ts`.

Os artefatos foram escritos, mas ainda não executados nesta rodada. Manter integrações em componentes/pages existentes onde já forem consumidores. Não mover arquitetura inteira para atender a esta story.

### Data and Transaction Boundary

pcm.regras_visita_contratual (Cliente, contrato, frequência, dia semanal, horas, deslocamento opcional, timezone, vigência); pcm.excecoes_calendario (origem, motivo, data, natureza, aprovação); Ocorrência guarda rotina lógica/versão, alvo, ciclo estável, vencimento original, programação, janela e validação. Unique de ciclo não usa apenas versão e não usa SNN da planilha. Snapshot de modo e tolerâncias preserva baseline.

Ver [data-model.md](data-model.md) e [commands.md](contracts/commands.md). A decisão de identidade estável do ciclo e preservação do vencimento original está em [ADR-1678](../../docs/adr/1678-ciclo-estavel-e-vencimento-original.md). As migrations 1820 e 1821 foram alocadas após conferir a sequência presente no candidato. Mudanças de regras herdadas usam expand/compatibilidade/backfill/verificação antes de retirar restrições. Story sem novo dado persistido reutiliza schema da dependência e altera apenas consulta/RPC necessária, sem tabela artificial. Aplicação e validação permanecem pendentes em T016.

### Contract and UI

simular_calendario, alterar_dia_contratual, materializar_ocorrencias, decidir_vencidos; materialização recebe janela/data de referência e retorna criadas/existentes/suprimidas administrativas; decisão explícita para retroativos.

Servidor valida requestId, expectedRevision, sessão/escopo e payload. Mudança + auditoria + intenção externa na mesma transação. Integração cross-feature passa DTO em packages/shared existente, não import de feature. UI reutiliza navegação/detalhes do Cliente360 e módulos globais, com mesmo gateway e query keys. Atualização só invalida após sucesso; erro mantém edição/preview.

### Migration and Recovery

Inventariar contagens/referências legadas no ambiente de teste; mapear explicitamente novo vínculo. Não inferir execução de X, não recriar registro externo por ausência de mapping e não apagar histórico. Se algoritmo/contrato real divergir, registrar SPEC_DEVIATION e nova ADR antes de ampliar efeito; os ADRs anteriores permanecem preservados.

### Large-volume change-day flow (AC-8)

Reuse the existing `1820/1821` staged snapshot tables, cursor pagination, per-page review, idempotent request ID and atomic confirmation. Present persisted state `montando` as **Em andamento** and keep all feature/operational gates closed by default. The pgTAP fixture prepares 501 visits with an isolated gate budget of 600; this is authored evidence only until the final combined run. Keep the deployed gate at 500 until the combined isolated run measures database locks, WAL, duration and memory at representative volume; then set an explicit ceiling. Do not replace the atomic transaction with independently committed batches. Compare candidate/source sets and use bounded pages; any optimization must preserve transition/audit routines and lock order. See [ADR-1671](../../docs/adr/1671-mudanca-dia-grande-volume.md) and [ADR-1682](../../docs/adr/1682-mudanca-dia-grande-volume-implementacao.md).

## Validation and Rollout

Por US: testes de domínio/transação, adapter, UI e integração estão escritos. Rodar quickstart com dois Clientes no lote final. CT relacionados: CT-007, CT-008, CT-009, CT-010. Cada um de AC-1 a AC-8 precisa evidência, não só checkbox.
A validação exige testes focados, `pnpm run eval:spec` (ver limitação no guia Terra), `pnpm run ci:local`, CI com db-tests não pulado e revisão adversarial antes de PASS arquitetural. Após código, graphify update. Só humano/@devops faz push/PR/deploy; Fabrício libera integração real. Nesta entrega não executar esse rollout.

## Complexity Tracking

Sem exceção à constituição. Repor automaticamente semana de feriado; inferir modo por frequência; envio Auvo; recalcular passado.
