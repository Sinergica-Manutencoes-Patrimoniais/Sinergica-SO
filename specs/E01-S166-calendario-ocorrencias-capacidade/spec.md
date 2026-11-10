# Feature Specification: Calendário contratual, recorrência por modo e ocorrências idempotentes

**Story:** E01-S166 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch:** `codex/handoff-plano-manutencao`
**Status:** T001–T015 implementados; pgTAP integrado, fluxo V2 com 501 visitas e E2E visual isolado (run 42279514855) passaram em clone descartável. Medição de capacidade, concorrência real, CI e homologação seguem em T016; gates de produção continuam fechados. Código escrito não constitui PASS.

**Input:** Caderno Técnico v1 (SSO-005, SSO-006) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Construir calendário válido antes de gerar (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Suprimir sexta feriado, mover dia para terça com vigência e manter Visita extra/reprogramada existente.

**Acceptance Scenarios:**

- **AC-1:** Dado modo por Visita e feriado no dia contratual, quando projetar semana, então não gera Visita nem ocorrência daquela Visita, capacidade nem indicador previsto/pendente/atrasado/dispensado/executado; somente auditoria de supressão.
- **AC-2:** Dado modo por calendário, quando vencimento mensal/anual/legal cair em feriado, então obrigação permanece pendente ao PCM; execução na semana seguinte não desloca próximo vencimento.
- **AC-3:** Dada mudança de dia fixo com vigência, quando aplicar, então só futuro não confirmado muda; mantém passado, extras, exceções aprovadas, reprogramações e IDs Auvo existentes; Visita extra pode coexistir na semana.

### US2 — Materializar ciclos e avaliar prazo sem duplicar (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Em 01/10 gerar janela 30 dias duas vezes em concorrência; testar 31/jan, tolerância zero e nova versão com mesmo ciclo.

**Acceptance Scenarios:**

- **AC-4:** Dada âncora 31/01, quando calcular meses, então usa último dia em fevereiro e 31/03; intervalos dias/semanas/meses/anos são explícitos, execução antecipada/tardia não move âncora e vigência cruza anos.
- **AC-5:** Dado hoje 01/10 e janela padrão 30 dias inclusiva, quando materializar, então inclui 31/10 e exclui 01/11, cria por Rotina + alvo + ciclo uma ocorrência mesmo com duas sessões/retry/revisão; não cria tarefa Auvo. Rotina de climatização tem uma única origem de geração PMOC ou Plano; origem concorrente é rejeitada e recursos/laudos PMOC permanecem.
- **AC-6:** Dada ativação/retomada, quando houver vencidos, então lista para decisão PCM sem geração retroativa em massa; ocorrências elegíveis entram em fila Preventivas Aguardando sem criticidade corretiva; cancelada não reaparece automaticamente.
- **AC-7:** Dadas tolerâncias antes/depois da Rotina, quando avaliar prazo, então zero é padrão e valores inteiros não negativos são independentes; tolerância não altera data-base; mudança de recorrência gera versão e mantém vencimento original separado da programação.

### US3 — Tratar mudança de dia com grande volume (Priority: P1)

**Why this priority:** A alteração contratual precisa continuar íntegra quando há centenas de Visitas e sua conferência leva tempo.

**Independent Test:** Preparar fotografia com 501 Visitas em páginas, retomar a sessão, conferir cada página, exceder o teto configurado e confirmar/repetir uma fotografia válida sem efeito parcial.

**Acceptance Scenarios:**

- **AC-8:** Dada mudança com mais de 500 Visitas e dentro do teto operacional configurado, quando preparar a fotografia, então a pessoa vê o status **Em andamento**, consegue retomar a paginação e revisar o total; nenhuma Visita muda antes da confirmação explícita do conjunto completo, e a confirmação efetiva todas as alterações e auditoria atomicamente. Acima do teto ou após divergência/expiração, nenhuma alteração parcial ocorre; repetição do mesmo pedido recupera o resultado idêntico.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Construir calendário válido antes de gerar, conforme AC-1, AC-2, AC-3.
- **FR-002:** Materializar ciclos e avaliar prazo sem duplicar, conforme AC-4, AC-5, AC-6, AC-7.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.
- **FR-005:** Suportar mudança de dia acima de 500 Visitas pelo fluxo paginado com estado persistido **Em andamento**, teto configurável por gate e confirmação atômica; não aceitar volume sem limite ou abrir gates por padrão.

### Key Entities

Calendário contratual define frequência, dia, horas, deslocamento e vigência. Exceção preserva motivo/aprovação. Ocorrência identifica Rotina, alvo e ciclo, mantendo vencimento original, programação e versão de origem.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Suprimir sexta feriado, mover dia para terça com vigência e manter Visita extra/reprogramada existente.
- **SC-004:** Concluir uma mudança acima de 500 Visitas dentro do teto medido e configurado, com revisão de todas as páginas, sem escrita parcial e com replay recuperável.

## Assumptions & Dependencies

Requer contratos implementados de E01-S165, E01-S171. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Fabrício definiu o status **Em andamento** para operações desse tipo. O teto fica configurável e fechado no valor atual até medição integrada; não se presume volume ilimitado nem se abre gate por padrão. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Repor automaticamente semana de feriado; inferir modo por frequência; envio Auvo; recalcular passado. Deploy e disparos reais permanecem fora desta entrega.

## Traceability

CT-007, CT-008, CT-009, CT-010. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
