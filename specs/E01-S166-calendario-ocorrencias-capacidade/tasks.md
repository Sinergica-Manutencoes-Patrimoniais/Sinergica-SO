# Tasks — E01-S166: Calendário contratual, recorrência por modo e ocorrências idempotentes

**Input:** spec.md, plan.md, research.md, data-model.md, contracts/commands.md. **Status:** T001–T015 e T018 implementados. A confirmação em lote passou 38 assertions pgTAP e o E2E visual isolado passou no run 42279514855; medição de capacidade, concorrência real, CI do candidato e homologação aguardam T016. Código escrito não declara PASS.

### Estado da evidência no candidato

- Código encontrado: domain/application/adapters, testes unitários e pgTAP em `E01-S166_mudanca_dia_v2_contract.test.sql` e `E01-S166_versoes_recorrencia_tolerancia.test.sql`, além de E2E isolado e runner.
- A referência antiga de pgTAP em `plan.md` foi corrigida em T002 para os arquivos encontrados.
- Fluxo V2 acima de 500 passou no lote integrado: a fixture pgTAP configura `max_itens=600` e prepara 501 visitas, cobrindo paginação, rollback, confirmação e replay pelo produtor canônico. Produção mantém teto 500 e gates fechados até medição/revisão de capacidade; a UI V1 permanece limitada a 500 quando V2 está desligado.

## Phase 1 — Setup

- [X] T001 Revalidar dependências e reuso em `specs/E01-S166-calendario-ocorrencias-capacidade/research.md`, conferindo ADR-0026/0027/0028 e `docs/planejamento/plano-manutencao/contratos-programa.md` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).

## Phase 2 — Foundation

- [X] T002 Escrever testes pgTAP para constraints, autorização permitida/negada, isolamento Cliente, requestId/revisão e grande volume em `supabase/tests/E01-S166_mudanca_dia_v2_contract.test.sql`, além das regras de recorrência/tolerância em `supabase/tests/E01-S166_versoes_recorrencia_tolerancia.test.sql` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8). As duas fixtures passaram no lote integrado; concorrência em duas sessões permanece em T016.
- [X] T003 Criar migration aditiva E01-S166 em `supabase/migrations/1820_E01-S166_mudanca_dia_v2_fundacao.sql` e `1821_E01-S166_mudanca_dia_v2_rpc.sql`; aplicar constraints, transições, RLS FORCE, auditoria append-only e protocolo requestId/revisão, preservando compatibilidade (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8). Migrations escritas; aplicação ao clone e validação permanecem em T016.

## Phase 3 — US1: Construir calendário válido antes de gerar

**Independent Test:** Suprimir sexta feriado, mover dia para terça com vigência e manter Visita extra/reprogramada existente.

- [X] T004 [US1] Escrever teste unitário para projetar frequência/dia/vigência, exceções, extras/reprogramações e impacto contratual em `apps/web/src/features/pcm/domain/calendario-contratual-us1.test.ts` (AC-1, AC-2, AC-3).
- [X] T005 [US1] Escrever testes de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/calendario-contratual-us1.test.ts` conforme contrato de comandos (AC-1, AC-2, AC-3).
- [X] T006 [US1] Implementar projeção de frequência/dia/vigência, exceções por modo, extras/reprogramações e impacto em `apps/web/src/features/pcm/domain/calendario-contratual.ts` (AC-1, AC-2, AC-3).
- [X] T007 [US1] Implementar casos de uso/RPCs e adapter em `apps/web/src/features/pcm/application/calendario-contratual.ts` e `apps/web/src/features/pcm/infrastructure/supabase-calendario-contratual-adapter.ts` (AC-1, AC-2, AC-3).
- [X] T008 [US1] Implementar consultas/invalidação e Workspace da jornada US1 com estados de carregamento/erro/retry e navegação por teclado/foco em `apps/web/src/features/pcm/application/` e `apps/web/src/features/pcm/interfaces/calendario-contratual/Workspace.tsx` (AC-1, AC-2, AC-3).

## Phase 4 — US2: Materializar ciclos e avaliar prazo sem duplicar

**Independent Test:** Em 01/10 gerar janela 30 dias duas vezes em concorrência; testar 31/jan, tolerância zero e nova versão com mesmo ciclo.

- [X] T009 [US2] Escrever teste unitário para ciclos estáveis e intervalos dias/semanas/meses/anos, virada de ano, vencidos/cancelamento e tolerâncias sem duplicação em `apps/web/src/features/pcm/domain/calendario-contratual-us2.test.ts` (AC-4, AC-5, AC-6, AC-7). Artefatos escritos; execução permanece em T016.
- [X] T010 [US2] Escrever testes de comando, rollback, Cliente divergente e repetição em `apps/web/src/features/pcm/application/calendario-contratual-us2.test.ts` conforme contrato de comandos (AC-4, AC-5, AC-6, AC-7).
- [X] T011 [US2] Implementar ciclos estáveis, decisões de vencidos/cancelamento e tolerâncias em `apps/web/src/features/pcm/domain/calendario-contratual.ts` (AC-4, AC-5, AC-6, AC-7).
- [X] T012 [US2] Implementar casos de uso/RPCs e adapter em `apps/web/src/features/pcm/application/calendario-contratual.ts` e `apps/web/src/features/pcm/infrastructure/supabase-calendario-contratual-adapter.ts` (AC-4, AC-5, AC-6, AC-7).
- [X] T013 [US2] Implementar consultas/invalidação e Workspace da jornada US2 com estados de carregamento/erro/retry e navegação por teclado/foco em `apps/web/src/features/pcm/application/` e `apps/web/src/features/pcm/interfaces/calendario-contratual/Workspace.tsx` (AC-4, AC-5, AC-6, AC-7).

## Phase 5 — Integration and Gates

- [X] T014 Escrever teste do adapter em `apps/web/src/features/pcm/infrastructure/supabase-calendario-contratual-adapter.test.ts` e integrar chamadas entre US. A execução de integração, rollback e duas sessões concorrentes fica em T016 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7).
- [X] T015 Escrever E2E isolado da jornada de calendário/Plano, grande volume com 501 Visitas e negação entre Clientes em `apps/web/e2e/calendario-contratual.spec.ts`, compondo consumidor Cliente360 sem duplicar regra; jornada visual passou no run 42279514855 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8).
- [ ] T016 Executar `specs/E01-S166-calendario-ocorrencias-capacidade/quickstart.md`, testes focados (incluindo AC-8), eval:spec com seleção conferida, ci:local e revisão adversarial; medir capacidade do V2 em clone isolado e só então propor teto acima de 500. Registrar comandos/resultados/ressalvas e futura CI com db-tests não pulado no mesmo roteiro antes de PASS (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8). Ver [registro integrado do lote](../../docs/planejamento/plano-manutencao/validacao-lote-s165-s166-s170-s176.md): a seleção pgTAP candidata passou 250 assertions e o E2E visual isolado passou no run 42279514855; a CI local integrada ainda falhou em gates globais e testes. Medição de capacidade, concorrência real em duas sessões, CI GitHub/db-tests e homologação permanecem pendentes.
- [X] T017 Corrigir seletor E2E, habilitar flags necessárias no build isolado e incluir diagnósticos da RPC de confirmação; execução agrupada permanece em T016.
- [X] T018 Preparar confirmação em conjunto das Visitas sem feriado, mantendo uma transação, revisão/estado, autorização, locks de composição antes dos locks de tabela/linha, validação de responsável/local, fuso da regra vigente, triggers, auditoria individual e `visita_comandos`; manter supressões por feriado no fluxo canônico (AC-4, AC-8). Ver [ADR-1683](../../docs/adr/1683-confirmacao-em-lote-mudanca-dia-v2.md), [ADR-1684](../../docs/adr/1684-locks-confirmacao-lote-mudanca-dia.md) e [ADR-1685](../../docs/adr/1685-nao-regravar-campos-na-mudanca-dia-em-lote.md). A seleção pgTAP integrada passou 38 assertions com o gate de composição habilitado; medição de capacidade e concorrência real em duas sessões permanecem em T016.

## Dependencies & Execution Order

E01-S165, E01-S171 antes da integração. Setup e testes de persistência precedem schema; testes de cada US precedem domínio/casos de uso/UI. US1 entrega MVP demonstrável em fixture; US2 conclui a operação. Nenhum passo envia Auvo real ou aplica migration de produção sem etapa autorizada.

## Parallel Opportunities and Terra Strategy

Testes de domínio e application/pgTAP em arquivos distintos podem ser preparados simultaneamente depois da fundação. Não paralelizar migrations nem alterações no mesmo gateway/domain/Workspace entre US. Implementar uma US e provar seus AC antes da próxima; fixtures isolam dependências sem declarar integração concluída. Atualizar glossário para termos introduzidos conforme índice global, e graphify após código; apenas humano/@devops fecha PR/deploy. Fora do escopo: Repor automaticamente semana de feriado; inferir modo por frequência; envio Auvo; recalcular passado.
