# Feature Specification: Visita operacional e associação histórica de OS

**Story:** E01-S171 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S171-visitas`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-002) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Agrupar e confirmar várias OS na Visita (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Agrupar preventiva, corretiva, PMOC e solicitação do mesmo Cliente em equipe/Visita e testar ciência padrão e obrigatória.

**Acceptance Scenarios:**

- **AC-1:** Dada Visita, quando adicionar OS de origens distintas do mesmo Cliente, então mantém contêiner com janela, equipe, responsável, horas, deslocamento, sequência e referências; OS de outro Cliente ou segundo vínculo vigente é negada.
- **AC-2:** Dada Visita planejada, quando PCM autorizado confirmar, então registra revisão e política resolvida; padrão não exige cliente, modo informativo não bloqueia e modo obrigatório exige confirmação/data/responsável/canal/observação.
- **AC-3:** Dado Cliente 360 ou agenda global, quando criar/abrir Visita, então usa o mesmo caso de uso, filtro Cliente e detalhe, com carregamento/vazio/erro/retry e foco preservado.

### US2 — Reprogramar e cancelar com rastro (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Mover OS/Visita já enviada mantendo tarefa remota e histórico, criar extra na mesma semana e cancelar após confirmação.

**Acceptance Scenarios:**

- **AC-4:** Dada OS em Visita, quando reprogramar, então fecha associação anterior e cria nova vigente com motivo/data/ator; preserva tarefa Auvo e gera somente intenção de atualização de E01-S168.
- **AC-5:** Dada confirmação prévia, quando alterar equipe, janela ou conteúdo, então invalida revisão confirmada e exige nova confirmação PCM; cancelamento concorrente impede envio de revisão antiga.
- **AC-6:** Dada Visita extra ou cancelada/parcial, quando salvar, então não muda regra contratual semanal, mantém regular na mesma semana e registra estados Rascunho/Planejada/Confirmada/Enviada/Em execução/Parcial/Concluída/Reprogramada/Cancelada conforme transição permitida.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Agrupar e confirmar várias OS na Visita, conforme AC-1, AC-2, AC-3.
- **FR-002:** Reprogramar e cancelar com rastro, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Visita agrupa Cliente, Posição, equipe, janela, horas, deslocamento e OS. Associação preserva em quais Visitas uma OS foi planejada. Confirmação registra revisão e política de ciência efetivamente usada.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Agrupar preventiva, corretiva, PMOC e solicitação do mesmo Cliente em equipe/Visita e testar ciência padrão e obrigatória.

## Assumptions & Dependencies

Requer contratos implementados de E01-S167, E01-S170. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Substituir apontamento por tarefa; associar OS de outro Cliente; reposição automática de feriado; escrever diretamente no Auvo. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-006, CT-010. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
