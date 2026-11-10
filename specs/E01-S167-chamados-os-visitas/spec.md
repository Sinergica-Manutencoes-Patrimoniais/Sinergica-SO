# Feature Specification: Chamado 1:N OS, continuidade e encerramento integral

**Story:** E01-S167 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S167-chamados-os`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-001) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Dividir necessidade em várias OS rastreáveis (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Criar um Chamado com três OS por comandos concorrentes distintos; retry de um comando não aumenta quantidade.

**Acceptance Scenarios:**

- **AC-1:** Dada ocorrência preventiva, quando originar seu Chamado, então há um único Chamado preventivo vinculado à ocorrência, inclusive em retry/concorrência. Dado Chamado, quando criar três OS com escopos diferentes, então todas pertencem ao mesmo contêiner e têm IDs/referências próprias; retry idêntico não duplica e comandos distintos são permitidos.
- **AC-2:** Dado quadro gerencial, quando visualizar Chamado com várias OS, então existe um único card por Chamado com progresso/OS internas; listas de OS conservam unidades executáveis e contexto Cliente.
  - Decisão de Fabrício informada por Lucas em 2026-10-29: se as OS do Chamado estiverem em etapas diferentes, apresentar o Chamado como **Em andamento**; manter o status individual de cada OS. Lucas aprovou o progresso em contagem, por exemplo **1 de 3 OS finalizadas**. Esta decisão não define outros casos nem altera regras de encerramento.
- **AC-3:** Dados registros antigos, quando migrar leitura/escrita para ordens_servico.chamado_id, então UUIDs, números e links permanecem; campo singular não governa novas relações nem impede segunda OS.

### US2 — Continuar, suspender e encerrar sem perder escopo (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Fechar duas de três OS, encerrar anterior parcial, criar continuação com 2 HH restantes e deixar parcela sem OS; tentar encerrar Chamado.

**Acceptance Scenarios:**

- **AC-4:** Dada OS parcial, quando técnico sugerir trabalho/horas restantes e PCM revisar, então nova OS recebe somente restante, mantém vínculo com anterior e horas executadas nela; não duplica demanda futura.
- **AC-5:** Dadas todas OS encerradas mas parcela sem atendimento ou continuação ainda não criada, quando avaliar Chamado, então não fica apto; somente escopo integral e todas OS encerradas indicam aptidão, e encerramento exige ação PCM.
- **AC-6:** Dado Chamado suspenso/cancelado com motivo, quando devolver escopo, então somente não resolvido volta vinculado ao Backlog de E01-S174; execução e histórico permanecem e retorno/reabertura não apagam eventos anteriores.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Dividir necessidade em várias OS rastreáveis, conforme AC-1, AC-2, AC-3.
- **FR-002:** Continuar, suspender e encerrar sem perder escopo, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Chamado contém necessidade integral; OS atende parcela executável e pode ter continuação. Composição do escopo registra partes atendidas/restantes. Identidades e referências antigas permanecem consultáveis.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Criar um Chamado com três OS por comandos concorrentes distintos; retry de um comando não aumenta quantidade.

## Assumptions & Dependencies

Requer contratos implementados de E01-S170. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Envio Auvo; Visita (E01-S171); criar Backlog como OS; renumerar legado. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-001, CT-002, CT-019. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
