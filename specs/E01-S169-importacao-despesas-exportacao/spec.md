# Feature Specification: Importação e exportação dos Planos Rimini e I Home

**Story:** E01-S169 · **Owner:** Terra · **Created:** 2026-10-26  
**Feature Branch (planejada):** `feat/E01-S169-importacao-plano`  
**Status:** Especificada — implementação não iniciada. Documentação preparada em `codex/handoff-plano-manutencao`.

**Input:** Caderno Técnico v1 (SSO-006, SSO-021) e definições do Fabrício posteriores ao caderno.

## User Scenarios & Testing

### US1 — Conferir e importar planos sem inventar dados (Priority: P1)

**Why this priority:** Entrega o objeto canônico e protege a origem antes das ações dependentes.

**Independent Test:** Mapear Rimini 59 linhas e I Home 53; repetir lote e incluir um vínculo inexistente e tempo SPCI zero.

**Acceptance Scenarios:**

- **AC-1:** Dadas amostras, quando mapear, então oferece correspondências de cadastros existentes, disciplina separada de Sistema, erros por linha e revisão PCM antes da gravação; nenhuma OS/tarefa nasce só por importar.
- **AC-2:** Dado Rimini, quando aprovar, então preserva 59 registros e 25 tempos SPCI como Tempo a validar; 103 h conhecidas não incluem esforço pendente e 5,6 h não vira padrão universal.
- **AC-3:** Dado I Home, quando mapear, então preserva 53 registros, exclusões próprias e vigência 05/08/2026–28/07/2027; S01 do I Home e S31 do Rimini para mesma data não colidem; X é programação, nunca execução.
- **AC-4:** Dado lote repetido ou linha alterada, quando reprocessar, então apresenta novos/alterados/rejeitados e aprovação controlada sem duplicar Rotina/ciclo; premissa mensal quatro semanas da fonte exige mapeamento explícito para calendário real.

### US2 — Exportar versão e cronograma conferíveis (Priority: P2)

**Why this priority:** Completa o fluxo operacional com decisões auditáveis e preservação do trabalho anterior.

**Independent Test:** Exportar Plano filtrado em PDF/XLSX e comparar datas, alvo, versão, filtros e capacidade opcional.

**Acceptance Scenarios:**

- **AC-5:** Dada Versão selecionada, quando exportar PDF/planilha, então identifica Cliente, vigência, versão, filtros, escopo, Rotinas, periodicidade e datas; inclusão de capacidade é explícita.
- **AC-6:** Dadas linhas retiradas, demanda incompleta ou feriado, quando exportar cronograma operacional, então mesmas regras do SO são usadas, distingue baseline/programado e não promete 52 Visitas após supressões.

### Edge Cases

- Repetição de comando, edição concorrente, referência removida, Cliente divergente e permissão revogada preservam dados existentes e informam motivo/ação de correção.
- Ausência de dados ou falha de uma seção permite consultar contexto já disponível, com indicação de incompletude e retry.

## Requirements

### Functional Requirements

- **FR-001:** Conferir e importar planos sem inventar dados, conforme AC-1, AC-2, AC-3, AC-4.
- **FR-002:** Exportar versão e cronograma conferíveis, conforme AC-5, AC-6.
- **FR-003:** Preservar identidade, vínculo de origem e histórico em toda transição; escrita exige autorização efetiva para ação e Cliente.
- **FR-004:** Tratar carregamento, vazio, falha e sucesso, navegação por teclado e retorno ao contexto de origem.

### Key Entities

Lote de importação guarda origem, mapeamento, linhas e decisões. Plano importado referencia cadastros existentes e periodicidades explícitas. Exportação identifica Versão e filtros utilizados.

## Success Criteria

- **SC-001:** Todos os cenários AC desta story são demonstráveis em teste sem perda de identidade/histórico ou mistura de Clientes.
- **SC-002:** Repetir a mesma decisão não duplica seus efeitos; todos os resultados de autorização positiva/negativa são verificáveis.
- **SC-003:** Mapear Rimini 59 linhas e I Home 53; repetir lote e incluir um vínculo inexistente e tempo SPCI zero.

## Assumptions & Dependencies

Requer contratos implementados de E01-S165, E01-S166, E01-S178. A demonstração isolada usa fixtures dessas dependências; integração real exige que elas estejam concluídas.

Fontes de negócio prevalecem sobre limitações atuais. `docs/planejamento/plano-manutencao/definicoes-fabricio-caderno-v1.md` fecha P01/P02/P03; não perguntar novamente. Técnica de migração/contrato externo é gate de implementação, não requisito já homologado.

## Out of Scope

Despesas (transferidas E01-S180); recriar staging; inventar cadastro/mapeamento Auvo; declarar equivalência executiva de X. Nesta sessão, somente especificação, sem executar tarefas de implementação, deploy ou disparos reais.

## Traceability

CT-030. Ver matriz global em `docs/planejamento/plano-manutencao/matriz-rastreabilidade.md` e `tasks.md` local.
