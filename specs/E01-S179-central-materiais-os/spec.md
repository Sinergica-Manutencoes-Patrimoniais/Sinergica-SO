# Feature Specification: Central de Materiais, parser determinístico e exceções de campo

**Story:** E01-S179 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S179-listas-materiais`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-013, SSO-014) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Organizar lista simples e revisável (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Importar bullets com quantidades, linha vazia e prosa ambígua; juntar/dividir e comparar original preservado.

**Acceptance Scenarios:**

- **AC-1:** Dada lista, quando cadastrar, então exige OS/Cliente, responsável, texto original e estado; Central filtra por Cliente/responsável/OS e abre contexto em Chamado/360.
- **AC-2:** Dado texto com linhas/marcadores e quantidade explícita, quando organizar sem IA, então gera linhas revisáveis; prosa ambígua fica intacta e não inventa produto/unidade/quantidade.
- **AC-3:** Dadas linhas organizadas, quando juntar/dividir/editar, então original permanece evidência e itemização é opcional; salvar texto simples continua possível.

### US2 — Controlar disponibilidade por informação e exceção (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Cliente informa lista disponível, técnico aponta dois faltantes; PCM suspende/reprograma a mesma OS e consulta histórico.

**Acceptance Scenarios:**

- **AC-4:** Dado responsável Cliente ou Sinérgica, quando informar disponibilidade, então registra autor/data e caráter informativo; não afirma conferência física nem exige confirmação item a item.
- **AC-5:** Dado material faltante/parcial/errado ou novo levantamento em campo, quando registrar, então reabre exceção com evidências e permite suspender/reprogramar mesma OS preservando tarefa Auvo e história.
- **AC-6:** Dada aquisição Sinérgica, quando encaminhar, então fornece vínculo à composição de orçamento E01-S181; material é fornecimento, não despesa da Visita e não gera faturável antes de evento elegível.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Organizar lista simples e revisável, conforme AC-1, AC-2, AC-3.
- **FR-002:** Controlar disponibilidade por informação e exceção, conforme AC-4, AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Lista de materiais pertence a OS/Cliente, guarda texto original, responsável e estado. Linhas revisáveis são opcionais. Informação de disponibilidade não é conferência física; exceção registra falta, quantidade errada ou novo levantamento.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Importar bullets com quantidades, linha vazia e prosa ambígua; juntar/dividir e comparar original preservado.

## Assumptions & Dependencies

Requer contratos implementados de E01-S167, E01-S171, E01-S170. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Estoque/ERP completo; conferir fisicamente material do cliente obrigatoriamente; inventar unidade/produto; tratar compra como despesa/reembolso. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-022, CT-023. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
