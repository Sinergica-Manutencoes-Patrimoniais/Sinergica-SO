# Tasks — E01-S177: Código público protegido, aliases e política de Equipment Auvo

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status** (auditoria de código em 2026-11-10, madrugada): **story essencialmente pronta**, tasks.md estava desatualizado. Divergência de nome de arquivo do plano (sem `domain/codigos-publicos.ts`/`application/codigos-publicos.ts` dedicados; lógica mora em `infrastructure/supabase-codigos-publicos-adapter.ts` + componentes de interface direto), mas cobertura real:
- **AC-1/AC-2/AC-3** (proteger identidade no primeiro uso): migrations `0363` (edição em rascunho), `0818`/`0822`/`1146` (diagnóstico de colisão, busca por código/alias), `1150` (evidências de uso travam edição). UI: `EdicaoRascunho.tsx`, `EvidenciasUso.tsx`, `ConsultaUnificada.tsx`/`ConsultaCodigoGrupo.tsx`, `ObservacoesReserva.tsx`. pgTAP: `E01-S177_codigo_rascunho_isolamento.test.sql`, `_inventario_codigos.test.sql`, `_busca_alias_codigo.test.sql`, na seleção oficial de `db-tests`.
- **AC-4** (substituição administrativa com alias atômico): `0332` cria `pcm.sso_substituir_codigo_publico`, grant `authenticated` confirmado na própria migration (linha 128); variante Grupo em `1399`/`1402`. UI `Substituicao.tsx` + teste: **2/2 passed** (rodado de dentro de `apps/web/`). pgTAP: `_substituicao_codigo_funcional.test.sql`, `_mediadores_codigo_transacao.test.sql`.
- **AC-5** (QR antigo/novo, alias nunca apagado): UI `AliasesAtivo.tsx` + teste: **4/4 passed**; `QrCodigoGrupo.tsx`, `DeclaracaoEtiqueta.tsx`, `HistoricoCodigoGrupo.tsx`. pgTAP: `_aliases_ativo.test.sql`. Caminho negativo exato (reimpressão após falha de sync) não confirmado linha a linha — hipótese não verificada se tem pgTAP dedicado.
- **AC-6** (política por categoria — Sistema=Equipment): `PoliticaEquipment.tsx` wired de verdade em `EstruturaClientePage.tsx:58,497` (não é código morto). Não achei pgTAP com nome óbvio pra essa regra — gap possível, não confirmado (pode estar sob nome de S178, mesmo schema).
- Testes TS rodados (`pnpm vitest run src/features/pcm/interfaces/codigos-publicos/` de dentro de `apps/web/`): `Test Files 3 passed, Tests 8 passed`.
- **T015 (e2e) e T016 (ci:local/homologação) seguem genuinamente pendentes**, mesmo padrão de gap visto em todas as stories desta sessão. Não reimplementar; próxima sessão deve só fechar AC-6/e2e/homologação.

## Phase 1 — Setup

- [ ] T001 Revalidar dependências e reuso em `specs/E01-S177-codigos-publicos-alias/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 2 — Foundation

- [ ] T002 Escrever testes pgTAP que falham para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e concorrência em `supabase/tests/E01-S177_codigos_publicos.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T003 Criar migration aditiva E01-S177 em `supabase/migrations/`, alocando próxima sequência real; aplicar constraints e transições de `specs/E01-S177-codigos-publicos-alias/data-model.md`, RLS FORCE, auditoria append-only e chave requestId/revisão transacional; preservar IDs/backfill de compatibilidade antes de retirar restrições (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Phase 3 — US1: Proteger identidade a partir do primeiro uso

**Independent Test:** Editar código em rascunho; aprovar, sincronizar, etiquetar e referenciar OS em testes separados; tentar edição comum.

- [ ] T004 [US1] Escrever teste unitário falho para persistir marcos de uso, guarda de edição e reserva única de código atual/alias preservando legado em `apps/web/src/features/pcm/domain/codigos-publicos-us1.test.ts`, usando todos os cenários desta US (AC-1, AC-2, AC-3).
- [ ] T005 [US1] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/codigos-publicos-us1.test.ts` conforme `specs/E01-S177-codigos-publicos-alias/contracts/commands.md` (AC-1, AC-2, AC-3).
- [ ] T006 [US1] Implementar persistir marcos de uso, guarda de edição e reserva única de código atual/alias preservando legado em `apps/web/src/features/pcm/domain/codigos-publicos.ts`, preservando constraints de `specs/E01-S177-codigos-publicos-alias/data-model.md` e decisões de `spec.md` (AC-1, AC-2, AC-3).
- [ ] T007 [US1] Implementar casos de uso/RPCs de US1 em `apps/web/src/features/pcm/application/codigos-publicos.ts` e `apps/web/src/features/pcm/infrastructure/supabase-codigos-publicos-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-1, AC-2, AC-3).
- [ ] T008 [US1] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/codigos-publicos-queries.ts` e jornada US1 em `apps/web/src/features/pcm/interfaces/codigos-publicos/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-1, AC-2, AC-3).

## Phase 4 — US2: Corrigir excepcionalmente e sincronizar só onde necessário

**Independent Test:** Administrador substitui código, reimprime etiqueta, consulta QR antigo/novo e aplica política Componente sem Equipment.

- [ ] T009 [US2] Escrever teste unitário falho para substituir código com alias pesquisável/QR compatível e política explícita de sync por categoria sem perda de vínculo remoto em `apps/web/src/features/pcm/domain/codigos-publicos-us2.test.ts`, usando todos os cenários desta US (AC-4, AC-5, AC-6).
- [ ] T010 [US2] Escrever testes falhos de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/codigos-publicos-us2.test.ts` conforme `specs/E01-S177-codigos-publicos-alias/contracts/commands.md` (AC-4, AC-5, AC-6).
- [ ] T011 [US2] Implementar substituir código com alias pesquisável/QR compatível e política explícita de sync por categoria sem perda de vínculo remoto em `apps/web/src/features/pcm/domain/codigos-publicos.ts`, preservando constraints de `specs/E01-S177-codigos-publicos-alias/data-model.md` e decisões de `spec.md` (AC-4, AC-5, AC-6).
- [ ] T012 [US2] Implementar casos de uso/RPCs de US2 em `apps/web/src/features/pcm/application/codigos-publicos.ts` e `apps/web/src/features/pcm/infrastructure/supabase-codigos-publicos-adapter.ts`, com autorização atual, revisão, idempotência e auditoria na transação (AC-4, AC-5, AC-6).
- [ ] T013 [US2] Implementar consultas/invalidação em `apps/web/src/features/pcm/application/codigos-publicos-queries.ts` e jornada US2 em `apps/web/src/features/pcm/interfaces/codigos-publicos/Workspace.tsx`, compondo superfícies existentes citadas em plan.md com loading/vazio/erro/retry, teclado e foco (AC-4, AC-5, AC-6).

## Phase 5 — Integration and Gates

- [ ] T014 Escrever e passar teste de adapter e integração entre US em `apps/web/src/features/pcm/infrastructure/supabase-codigos-publicos-adapter.test.ts`, incluindo rollback e duas sessões concorrentes (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T015 Cobrir jornada crítica e acesso negado com dois Clientes em `apps/web/e2e/codigos-publicos.spec.ts`; integrar consumidores globais/Cliente360 existentes indicados em `specs/E01-S177-codigos-publicos-alias/plan.md` sem duplicar regra (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).
- [ ] T016 Executar `specs/E01-S177-codigos-publicos-alias/quickstart.md`, testes focados, eval:spec com seleção conferida, ci:local e revisão adversarial; registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6).

## Dependencies & Execution Order

E01-S176, E01-S170 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Renumerar automático ao mover/renomear; apagar/reutilizar código anterior; excluir Equipment remoto para aplicar política; trocar rótulos de UI.
