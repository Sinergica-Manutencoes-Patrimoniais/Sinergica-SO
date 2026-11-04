# Feature Specification: Agenda oficial e capacidade por técnico, Cliente e semana

**Story:** E01-S172 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S172-capacidade-agenda`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-004) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Comparar demanda e disponibilidade com mesma unidade (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Simular 2h×2 técnicos×3 ocorrências, 12HH disponíveis, incluir 3HH e uma estimativa pendente; consultar por Cliente/técnico.

**Acceptance Scenarios:**

- **AC-1:** Dada duração por unidade, quando calcular, então HH = duração × técnicos × quantidade; tempo total do Sistema não multiplica quantidade outra vez, e OS/ocorrência ligadas contam só esforço restante uma vez.
- **AC-2:** Dada disponibilidade, quando consolidar, então usa horas realmente destinadas, desconta reservas/ausências configuradas, inclui deslocamento quando preenchido e mostra parâmetros; não presume jornada inteira preventiva.
- **AC-3:** Dado terceiro, quando consolidar, então separa execução externa de acompanhamento interno; somente acompanhamento Sinérgica consome equipe própria; zero/ausente mantém Demanda incompleta.

### US2 — Planejar por alerta consciente (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Planejar 10h em 8h, atividade de dois técnicos com só um disponível e conflito de agenda; confirmar justificativa e reprogramar.

**Acceptance Scenarios:**

- **AC-4:** Dada sobrecarga, conflito, ausência, perfil ou certificação, quando planejar, então mostra alerta e exige confirmação consciente/justificativa, mas permite continuar sem bloquear por esses alertas.
- **AC-5:** Dada capacidade aritmética suficiente mas equipe sem simultaneidade/especialidade, quando simular, então sinaliza incompatibilidade explicitamente; saldo HH não prova composição viável.
- **AC-6:** Dada reprogramação, quando comparar semanas, então mostra origem/destino e saldos antes de salvar, usa data programada ou vencimento na ausência, mantém baseline por vencimento e semana segunda–domingo inclusive virada anual.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Comparar demanda e disponibilidade com mesma unidade, conforme AC-1, AC-2, AC-3.
- **FR-002:** Planejar por alerta consciente, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Disponibilidade expressa horas realmente destinadas à operação. Demanda separa trabalho interno, terceiros, acompanhamento e deslocamento. Alerta evidencia excesso ou incompatibilidade sem bloquear planejamento nesta fase.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Simular 2h×2 técnicos×3 ocorrências, 12HH disponíveis, incluir 3HH e uma estimativa pendente; consultar por Cliente/técnico.

## Assumptions & Dependencies

Requer contratos implementados de E01-S171. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Bloquear planejamento por excesso/especialidade nesta fase; inferir disponibilidade de toda jornada; somar OS e ocorrência duplicadamente. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-011. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
