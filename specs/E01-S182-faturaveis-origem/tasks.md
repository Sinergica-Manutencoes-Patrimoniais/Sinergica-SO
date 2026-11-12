# Tasks — E01-S182: Fila A Faturar por origem única

**Status** (auditoria de código em 2026-11-10, madrugada): **story essencialmente pronta**, "implementação não iniciada" estava completamente errado — uma das implementações mais maduras do programa. **111 migrations** `E01-S182` (0343→1606): fila/unicidade (0343), estorno/complemento (0404 — `financeiro.sso_faturavel_complementos`/`sso_faturavel_estornos`, índice único `sso_faturavel_origem_base` por `(cliente_id, origem_tipo, origem_id) where item_base_id is null`, prova real de AC-1/AC-2), documento/parcelas (0716-0765), autorização de complemento (0789-0808), fato de serviço mediado (1503-1522, 1559-1606). **49 componentes TSX** em `apps/web/src/features/financeiro/interfaces/faturaveis/` chamando RPC `financeiro.*` direto (mesmo padrão "mediada" de outras stories hoje): `FilaFaturaveis` (AC-1/AC-2), `ConferirServico`/`AlocarDocumento`/`ParcelaAdicional`/`RecuperarParcela` (AC-3/AC-4), `ConferirEstornos` (AC-5), `DiagnosticoAceiteComplemento` (AC-6). `packages/shared/src/faturaveis-contracts.ts` existe (T002 real).
- Vitest de dentro de `apps/web/`: `faturaveis.test.ts`(8) + `faturaveis-contrato.test.ts`(2) + `RelatorioDespesasFaturaveis.test.tsx`(4) + `FilaFaturaveis.test.tsx`(5) + `CorrigirFaturavel.test.tsx`(3) = **22 passed**.
- **GAP-REAL-CONFIRMADO**: pgTAP fino — só 3 arquivos oficiais (`E01-S182_origem_alocacao_isolamento` plan 12, `_relatorio_mediado_acl` plan 7, `_reserva_bloqueia_alocacao` plan 7 = 26 assertions) pra 111 migrations; maioria das RPCs só provada em TS mockado, não RLS/concorrência real via pgTAP. Cobertura de componente rala: só 8 dos 49 `.tsx` têm teste colocado. Nenhum e2e (`apps/web/e2e/` sem arquivo faturáveis).
  - **Parcialmente fechado em 2026-11-11**: `E01-S182_complemento_faturavel.test.sql` (13 assertions, PASS) prova o complemento de item faturável (0404/1559) — nunca encadeia complemento sobre complemento, identidade item_base_id/complemento_id, índice único parcial `sso_faturavel_origem_base`, idempotência, concorrência otimista. **Achou e corrigiu um bug real nesse caminho**: `financeiro.sso_listar_alocacoes_mediada` (1559) tinha coluna `id` ambígua (parâmetro de saída da função vs. coluna do gate) — quebrava com 42702 em TODA chamada real, gate aberto ou fechado; nunca foi alcançável de verdade. Fix em migration 1834 (só qualifica o alias, sem mudar regra).
  - **Também fechado em 2026-11-11**: `E01-S182_alocacao_estorno_faturavel.test.sql` (15 assertions, PASS) prova alocação de documento (0401, 1560) + estorno de alocação (0404, 1559) de ponta a ponta — alocar até fechar o saldo exato vira 'faturado', nova alocação é recusada antes mesmo de checar saldo (item já faturado), estornar devolve pra 'conferido' e reabre o saldo inteiro, estornar de novo é recusado, concorrência otimista, idempotência, isolamento de Cliente. **Achado lateral registrado, não corrigido**: `financeiro.sso_faturavel_estornos` não tem trigger de imutabilidade, diferente do padrão append-only usado por quase todas as outras tabelas de comando desta sessão — candidato a revisão futura (pode ser intencional, não investigado a fundo).
  - **Ainda sem pgTAP**: repasse de despesa (mesmo arquivo 0404, `sso_declarar_repasse_despesa`), e a maior parte das 111 migrations (fato de serviço, exceção de preço, candidato de serviço).
- **Nota de escopo**: `financeiro` é módulo que a diretriz original do programa listava como "fora de escopo" ("módulos comercial/financeiro em paralelo") — não é decisão desta auditoria resolver essa tensão, só registrar que a story está codificada e funcional apesar disso.
- Não reimplementar. Candidata, junto com S175/S179/S181/S186, a receber pgTAP real numa próxima sessão.
**Input**: spec.md, plan.md, research.md, data-model.md e contracts/commands.md.
**Dependências**: E01-S180, E01-S181, E01-S167 (encerramento/escopo) e E01-S171 (Visita).
**Tests**: Obrigatórios por AC; escrever e observar falha antes de implementar. Não executar escrita externa real.

## Phase 1 — Setup

- [ ] T001 Conferir dependências, ADR-0026/0027/0028 e contrato global em docs/planejamento/plano-manutencao/contratos-programa.md; registrar mapa de reuso em specs/E01-S182-faturaveis-origem/research.md (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T002 Definir DTOs/envelope e invariantes de specs/E01-S182-faturaveis-origem/contracts/commands.md em packages/shared/src/faturaveis-contracts.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

Contrato do programa e autorizações são pré-requisitos. Não ampliar schema antes dos testes falharem; migrations pertencem à US que introduz a regra.

## Phase 3 — US1: Receber origem faturável uma vez

**Independent test**: Reprocessar e concorrer dez vezes sobre o mesmo fornecimento.

- [ ] T003 [US1] Escrever testes falhando de receber origem faturável uma vez em apps/web/src/features/financeiro/application/faturaveis-us1.test.ts (AC-1, AC-2).
- [ ] T004 [US1] Escrever pgTAP permitido/negado, repetição e vínculo das regras US1 em supabase/tests/E01-S182_faturaveis_origem_us1.test.sql (AC-1, AC-2).
- [ ] T005 [US1] Implementar recepção de candidatos com unicidade por fato e divergência explícita em apps/web/src/features/financeiro/domain/faturaveis.ts e migration aditiva E01-S182 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-1, AC-2).
- [ ] T006 [US1] Expor comandos autorizados US1 em apps/web/src/features/financeiro/application/faturaveis.ts e apps/web/src/features/financeiro/infrastructure/supabase-faturaveis-adapter.ts conforme contracts/commands.md (AC-1, AC-2).
- [ ] T007 [US1] Integrar jornada US1 em apps/web/src/features/financeiro/pages/AFaturarPage.tsx e apps/web/src/features/financeiro/application/faturaveis-queries.ts com invalidação por Conta e estados de interface (AC-1, AC-2).

## Phase 4 — US2: Conferir e efetivar documento

**Independent test**: Conferir e faturar item com documento; repetir pedido.

- [ ] T008 [US2] Escrever testes falhando de conferir e efetivar documento em apps/web/src/features/financeiro/application/faturaveis-us2.test.ts (AC-3, AC-4).
- [ ] T009 [US2] Escrever pgTAP permitido/negado, repetição e vínculo das regras US2 em supabase/tests/E01-S182_faturaveis_origem_us2.test.sql (AC-3, AC-4).
- [ ] T010 [US2] Implementar conferência e efetivação parcial transacional sobre Financeiro existente em apps/web/src/features/financeiro/domain/faturaveis.ts e migration aditiva E01-S182 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-3, AC-4).
- [ ] T011 [US2] Expor comandos autorizados US2 em apps/web/src/features/financeiro/application/faturaveis.ts e apps/web/src/features/financeiro/infrastructure/supabase-faturaveis-adapter.ts conforme contracts/commands.md (AC-3, AC-4).
- [ ] T012 [US2] Integrar jornada US2 em apps/web/src/features/financeiro/pages/AFaturarPage.tsx e apps/web/src/features/financeiro/application/faturaveis-queries.ts com invalidação por Conta e estados de interface (AC-3, AC-4).

## Phase 5 — US3: Cancelar, complementar e estornar

**Independent test**: Cancelar antes e estornar depois; adicionar complemento com referência.

- [ ] T013 [US3] Escrever testes falhando de cancelar, complementar e estornar em apps/web/src/features/financeiro/application/faturaveis-us3.test.ts (AC-5, AC-6).
- [ ] T014 [US3] Escrever pgTAP permitido/negado, repetição e vínculo das regras US3 em supabase/tests/E01-S182_faturaveis_origem_us3.test.sql (AC-5, AC-6).
- [ ] T015 [US3] Implementar cancelamento, estorno e complementos sem sobrescrita financeira em apps/web/src/features/financeiro/domain/faturaveis.ts e migration aditiva E01-S182 em supabase/migrations/ conforme data-model.md, preservando constraints e auditoria (AC-5, AC-6).
- [ ] T016 [US3] Expor comandos autorizados US3 em apps/web/src/features/financeiro/application/faturaveis.ts e apps/web/src/features/financeiro/infrastructure/supabase-faturaveis-adapter.ts conforme contracts/commands.md (AC-5, AC-6).
- [ ] T017 [US3] Integrar jornada US3 em apps/web/src/features/financeiro/pages/AFaturarPage.tsx e apps/web/src/features/financeiro/application/faturaveis-queries.ts com invalidação por Conta e estados de interface (AC-5, AC-6).

## Phase 6 — Integração e evidências

- [ ] T018 Cobrir jornada crítica, acesso direto e sessão revogada em apps/web/e2e/faturaveis-origem.spec.ts (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T019 Executar quickstart, revisão adversarial e registrar comandos/resultados/ressalvas em specs/E01-S182-faturaveis-origem/quickstart.md antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

T001 antes de T002; US1 é MVP. Em cada US, testes de application e pgTAP precedem persistência/domínio, adapter e interface. US2 e US3 usam objetos da US1 com fixtures próprias para verificação independente. Sem execução paralela de alterações no mesmo domain/adapter/page/migration; testes US1 de application e SQL podem ser preparados em paralelo por estarem em arquivos distintos.

## Implementation Strategy

Entregar uma US por vez, provar seus AC em ambiente local e preservar caminho legado necessário. Verificar catálogo CT-026. Somente depois completar evidências e revisão adversarial; deploy/cobrança/Auvo real dependem da etapa operacional própria. Todos os AC têm teste e implementação; nenhuma task marcada como concluída nesta entrega.

