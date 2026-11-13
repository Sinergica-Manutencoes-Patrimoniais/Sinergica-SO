# Feature Specification: Agenda com alocações e Preventivas com jornada visível

**Story:** E01-S192 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-13
**Feature Branch (planejada):** `feat/E01-S192-agenda-preventivas`
**Status:** Especificada — implementação não iniciada. **Investigação é a primeira tarefa** (ver abaixo).

**Input:** Reanálise do Fabrício de 12/11/2026, seção 4 (situação do SSO publicado) e perguntas 15, 16 e 17.

## Contexto — o problema que esta story resolve

Duas telas publicadas não mostram o que deveriam, e a causa ainda **não é conhecida**:

- **Agenda do Técnico** — "semana exibida sem alocações, apesar de haver tarefas e OS em execução".
- **Preventivas** — "o Kanban mostra 12 cartões preventivos do H2, mas a tela permanece sem jornada visível"; Plano, Rotina e Ocorrência não podem ser homologados.

A pergunta 16 da reanálise enumera as hipóteses: *gate, flag, falha de integração ou ausência de
interface*. São quatro causas com correções completamente diferentes, e tratar a errada custa a
story inteira.

Por isso **a primeira tarefa desta story é diagnóstico, não código** — e o resultado do
diagnóstico pode encolher ou dividir a story.

## User Scenarios & Testing

### US0 — Saber por que está vazio (Priority: P0, bloqueia as demais)

**Why this priority:** Quatro hipóteses, quatro correções. Codar antes de saber é aposta.

**Independent Test:** Para cada uma das duas telas, produzir uma conclusão nomeada — gate fechado, flag desligada, consulta sem retorno, ou componente ausente — com a evidência que sustenta.

**Acceptance Scenarios:**

- **AC-1:** Dada a Agenda do Técnico publicada, quando diagnosticada, então a causa do vazio é identificada entre gate, flag, dado ou interface, com evidência; se forem várias, todas são listadas.
- **AC-2:** Dada a tela de Preventivas, quando diagnosticada, então o mesmo — e fica registrado quais partes de Plano, Rotina e Ocorrência **já** têm interface e quais não têm (pergunta 17 da reanálise).

### US1 — Agenda mostra a alocação que existe (Priority: P1)

**Why this priority:** Agenda vazia com OS em execução faz o sistema parecer quebrado mesmo quando o dado está lá.

**Independent Test:** Com OS em execução e Visita agendada num Cliente de teste, abrir a semana e ver as alocações.

**Acceptance Scenarios:**

- **AC-3:** Dada uma semana com Visitas e OS alocadas, quando a Agenda carregar, então mostra cada alocação com técnico, horário e OS vinculadas — e o total de horas comprometidas.
- **AC-4:** Dada uma semana **sem** alocação, quando a Agenda carregar, então mostra estado vazio explicando que não há alocação no período, nunca uma grade em branco indistinguível de erro.
- **AC-5:** Dada uma falha ao consultar, quando ocorrer, então a tela diz que falhou e oferece nova tentativa — os três estados (carregando, vazio, erro) são distinguíveis entre si.
- **AC-6:** Dadas horas de acompanhamento de terceiro, quando exibidas, então aparecem separadas da capacidade própria.

### US2 — Preventivas mostra Plano, Rotina e Ocorrência (Priority: P1)

**Why this priority:** É a jornada que o piloto precisa demonstrar nas etapas 2 e 3.

**Independent Test:** A partir de um Plano com Rotina, percorrer até a Ocorrência gerada e voltar, sem sair para outra tela.

**Acceptance Scenarios:**

- **AC-7:** Dada a tela de Preventivas, quando carregada, então lista os Planos do Cliente com estado, versão vigente e Rotinas, e permite abrir cada um.
- **AC-8:** Dado um Plano aberto, quando consultar suas Ocorrências, então vê as geradas com vencimento, estado e origem, e consegue navegar até o Chamado ou a OS que nasceu de cada uma.
- **AC-9:** Dados os 12 cartões preventivos do Kanban citados na reanálise, quando a jornada estiver visível, então eles são alcançáveis a partir do Plano que os originou — ou fica registrado que são legado sem Plano correspondente, o que é informação, não defeito.

### Edge Cases

- Cliente sem nenhum Plano: estado vazio que ensina o próximo passo.
- Plano suspenso: ocorrências já geradas continuam visíveis e não mudam.
- Ocorrência de Plano em versão anterior à vigente: aparece com a versão que a originou.
- Semana que cruza virada de mês na Agenda.

## Requirements

### Functional Requirements

- **FR-001:** Diagnosticar e registrar a causa do vazio nas duas telas antes de qualquer correção, conforme AC-1, AC-2.
- **FR-002:** Exibir alocações, capacidade comprometida e terceiro separado na Agenda, conforme AC-3 a AC-6.
- **FR-003:** Expor a cadeia Plano → Rotina → Ocorrência na tela de Preventivas, com navegação até o objeto gerado, conforme AC-7 a AC-9.
- **FR-004:** Tratar carregamento, vazio e erro como três estados distintos em ambas as telas.

### Key Entities

Sem entidade nova. A story liga interface a dado que já existe.

## Success Criteria

- **SC-001:** As perguntas 15, 16 e 17 da reanálise têm resposta com evidência.
- **SC-002:** Agenda com alocação real mostra alocação; sem alocação, mostra vazio explicado.
- **SC-003:** A jornada Plano → Rotina → Ocorrência é percorrível na interface, sem SQL.
- **SC-004:** Ambas as telas distinguem carregando, vazio e erro.

## Assumptions & Dependencies

- **US0 pode reduzir drasticamente o escopo.** Se a causa for só flag desligada, a correção é de ativação (E01-S188) e não de interface — e esta story encolhe para o diagnóstico mais a correção de estado vazio.
- O motor de capacidade e o de Planos já existem e estão testados; a lacuna apontada é de interface.
- Precede ou acompanha E01-S191, cujas etapas 2, 3 e 6 dependem destas telas.

## Fora de escopo

- Reescrever o motor de capacidade ou o de versionamento de Plano.
- Consolidação de menu — isso é E01-S190.
