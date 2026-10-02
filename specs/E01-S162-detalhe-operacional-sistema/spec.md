---
name: E01-S162-detalhe-operacional-sistema
description: Painel lateral do Sistema com cadastro, OS, preventivas, histórico e componentes na tela Sistemas e na Visão 360.
alwaysApply: true
tier: arquitetural
---

# Spec — Detalhe operacional do Sistema

**Feature Branch**: `feat/detalhe-sistema-360`  
**Created**: 2026-10-02  
**Status**: Draft para planejamento  
**Input**: Lucas quer abrir o contexto completo de um Sistema ao clicar nele, tanto na tela
Sistemas quanto na aba Sistemas da Visão 360. Aprovou painel lateral em vez de página própria.

## User Scenarios & Testing

### User Story 1 — Abrir o contexto do Sistema (Priority: P1)

Fabrício consulta um Sistema e abre seu detalhe sem perder a lista ou o cliente que estava vendo.
O cabeçalho responde onde o Sistema está, quais dados de cadastro existem e quando foi cadastrado.

**Why this priority**: O detalhe precisa ser acessível antes de qualquer informação agregada ter valor.

**Independent Test**: Abrir o mesmo Sistema pela tela Sistemas e pela aba Sistemas de Guainumbí;
comparar identidade e cadastro, fechar e confirmar que a navegação anterior foi preservada.

**Acceptance Scenarios**:

1. **AC-1** — **Dado** usuário com leitura no PCM e Sistema ativo na tela Sistemas ou na aba
   Sistemas da Visão 360, **quando** aciona o nome/card por mouse ou teclado, **então** abre painel
   lateral com o mesmo Sistema; fechar por botão ou Escape devolve foco ao acionador e preserva
   cliente, aba, busca e posição da lista.
2. **AC-2** — **Dado** painel aberto, **então** exibe nome, identificador, cliente, categoria,
   descrição, Área/Local, estado de sincronização com Auvo, data de cadastro, última atualização
   e quantidade atual de componentes. Campo ausente aparece como “—” ou “Não informado”, sem data
   presumida. O detalhe é somente leitura; ações de editar e compor continuam nos controles já
   existentes.

---

### User Story 2 — Ver trabalho aberto e histórico de manutenção (Priority: P1)

Fabrício identifica quais OS ainda exigem ação, quem está responsável e o que já foi concluído
no Sistema ou em seus componentes atuais.

**Why this priority**: É a pergunta operacional principal ao abrir o Sistema.

**Independent Test**: Usar Sistema com OS direta, OS de componente e uma OS ligada aos dois;
verificar separação por estado, ausência de duplicatas e navegação para a OS correta.

**Acceptance Scenarios**:

3. **AC-3** — **Dado** Sistema com OS vinculadas diretamente ou aos seus componentes atuais,
   **quando** painel abre, **então** “OS abertas” mostra somente OS ainda não finalizadas nem
   canceladas, com número, título, status, técnico, data agendada e prioridade quando disponíveis.
   A origem “Sistema” ou o nome do componente fica visível. Mesma OS ligada por duas vias aparece
   uma vez. Cada linha permite abrir seu detalhe no PCM e oferece link direto ao Auvo quando houver
   vínculo remoto conhecido.
4. **AC-4** — **Dado** OS finalizadas ou canceladas desse mesmo conjunto de vínculos, **então**
   “Histórico de OS” as lista da mais recente para a mais antiga, com número, data, status,
   técnico e origem, sem misturar OS abertas. Cada linha permite abrir o detalhe da OS e,
   quando houver vínculo, a tarefa no Auvo. “Última manutenção” usa a data real da execução
   finalizada mais recente; data apenas agendada, OS cancelada ou sem confirmação de execução não
   conta como manutenção realizada. O histórico continua acessível se não houver OS abertas.

---

### User Story 3 — Acompanhar preventivas do Sistema (Priority: P2)

Fabrício vê o próximo vencimento e as execuções preventivas do Sistema e de seus componentes
atuais, mantendo o Auvo como lugar do formulário completo.

**Why this priority**: O planejamento preventivo completa a leitura operacional sem criar uma
segunda agenda.

**Independent Test**: Vincular um plano ao Sistema e outro a um componente; conferir próximo
vencimento, visita, resultado e link da OS em ambos, sem registros de outro cliente.

**Acceptance Scenarios**:

5. **AC-5** — **Dado** planos preventivos do Sistema ou de seus componentes atuais, **então**
   seção “Preventivas” mostra plano, alvo, periodicidade, próximo vencimento, visita agendada e
   estado da ocorrência, quando existirem. Execuções anteriores mostram data, técnico, resultado
   `Pendente`, `OK` ou `Não OK` e número/ID da OS. Link “Ver OS no Auvo” aparece só com vínculo
   remoto conhecido; o formulário completo permanece no Auvo. Plano pausado conserva histórico
   e não é apresentado como próximo vencimento ativo.

---

### User Story 4 — Conferir composição atual (Priority: P2)

Fabrício confere quais componentes pertencem ao Sistema e pode abrir o detalhe individual de um
deles sem alterar vínculos durante a consulta.

**Why this priority**: A composição explica o alcance das OS e preventivas agregadas.

**Independent Test**: Abrir Sistema com componentes em posições distintas, conferir nomes,
quantidade e posição de cada um; abrir um componente e voltar ao Sistema.

**Acceptance Scenarios**:

6. **AC-6** — **Dado** painel do Sistema, **então** “Componentes” lista somente membros atuais,
   com nome, identificador e Área/Local quando disponíveis; componente com posição diferente da
   do Sistema mantém sua posição própria. A quantidade coincide com a lista. Cada componente pode
   abrir o detalhe já disponível para ele; o painel não altera composição.
7. **AC-7** — **Dado** usuário sem escrita no PCM, **então** pode consultar o painel e seus links,
   mas não vê ações de edição nele. Sem leitura no PCM, não pode abrir nem receber dados do
   detalhe. Na Visão 360, trocar de cliente com painel aberto fecha ou substitui o detalhe antes
   de mostrar dados do novo cliente; nenhum dado de outro cliente permanece visível.

### Edge Cases

- Sem OS, plano ou componente: cada seção mostra vazio específico; nenhuma seção vazia oculta as
  demais.
- Sem vínculo Auvo: dados locais continuam visíveis; link remoto não aparece.
- OS ligada ao Sistema e a componente(s): aparece uma vez, com indicação de todas as origens
  relevantes, sem perder o alvo direto.
- Falha ao carregar uma seção: mensagem e “Tentar novamente” naquela seção; outras seções
  continuam consultáveis.
- Sistema desativado ou removido enquanto painel está aberto: informa indisponibilidade e fecha
  o contexto antigo; não apresenta dados de outro Sistema por engano.
- Histórico de composição anterior ao cadastro atual não pode ser reconstruído sem eventos
  registrados; o painel exibe a composição atual e as datas conhecidas do cadastro.

## Requirements

### Functional Requirements

- **FR-001**: A tela Sistemas e a aba Sistemas da Visão 360 devem abrir o mesmo detalhe lateral
  para um Sistema selecionado. **Aceite**: AC-1.
- **FR-002**: O painel deve apresentar cadastro e datas reais do Sistema, distinguindo ausências
  de valores conhecidos. **Aceite**: AC-2.
- **FR-003**: O painel deve separar OS abertas de finalizadas/canceladas e reunir OS diretas e
  dos componentes atuais sem duplicatas. **Aceite**: AC-3, AC-4.
- **FR-004**: Cada OS deve permitir navegação ao detalhe no PCM e, quando conhecida, à tarefa
  correspondente no Auvo. **Aceite**: AC-3, AC-4.
- **FR-005**: A última manutenção deve refletir uma execução concluída, nunca um agendamento ou
  cancelamento. **Aceite**: AC-4.
- **FR-006**: A seção preventiva deve usar os mesmos estados e resultados já mostrados pela
  Preventiva do cliente, incluindo próximo vencimento e vínculo remoto. **Aceite**: AC-5.
- **FR-007**: A composição deve refletir membros atuais e permitir consultar cada componente.
  **Aceite**: AC-6.
- **FR-008**: O detalhe deve respeitar leitura/escrita do PCM e isolamento entre clientes.
  **Aceite**: AC-7.
- **FR-009**: Cada seção deve tratar carregamento, vazio e erro sem impedir a leitura das demais.
  **Aceite**: Edge Cases.

### Key Entities

- **Sistema**: agrupamento funcional de um cliente, com cadastro, posição, estado e datas.
- **Componente**: membro atual do Sistema, com identidade e posição próprias.
- **OS**: trabalho vinculado diretamente ao Sistema ou a um componente; possui estado,
  responsável, datas e vínculo remoto quando disponível.
- **Plano e ocorrência preventiva**: recorrência e execução individual associadas ao Sistema ou
  componente; ocorrência pode ter OS e resultado consolidado.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Em teste com usuários do PCM, ao menos 90% localizam OS aberta, técnico e próximo
  vencimento de um Sistema em até 30 segundos após abrir sua lista.
- **SC-002**: Em 100% dos cenários de teste com OS vinculada por mais de uma origem, ela aparece
  uma única vez em cada seção aplicável.
- **SC-003**: Em 100% dos cenários de teste, “Última manutenção” corresponde à execução
  finalizada mais recente ou mostra ausência explícita.
- **SC-004**: Em 100% dos cenários de troca de cliente e de usuário sem leitura, o painel não
  exibe dados de Sistema fora do cliente ou da permissão vigente.
- **SC-005**: Em 95% das aberturas de Sistemas com até 200 componentes e 100 OS relacionadas,
  o conteúdo inicial do painel fica consultável em até 3 segundos numa conexão estável de 20 Mbps.

## Assumptions

- “Detalhe do Sistema” é consulta operacional; cadastro, composição, execução técnica e
  questionário seguem seus fluxos atuais.
- O conjunto agregado usa vínculos atuais entre Sistema e componentes. Histórico de componentes
  removidos não é inferido como se ainda pertencessem ao Sistema.
- Datas de cadastro e atualização são as registradas no PCM. Alterações antigas de composição
  sem evento auditável não geram linha de histórico retroativa.
- OS abertas são as que ainda não estão finalizadas ou canceladas, conforme estados vigentes do
  PCM. Resultado preventivo segue a regra já aprovada em E01-S53.
- Acesso ao Auvo usa vínculo remoto já conhecido; não se cria OS nem se consulta formulário
  completo para montar este painel.

## Fora de escopo

- Criar, editar, cancelar ou reagendar OS e preventivas pelo painel.
- Alterar membros do Sistema pelo painel; edição e composição existentes continuam seus fluxos.
- Reconstituir alterações antigas de composição sem registro prévio.
- Mostrar formulário, fotos, medições ou relato completos do Auvo dentro do PCM.
- Alterar o clique de expansão dos Sistemas na aba Árvore da Visão 360.

## Rastreabilidade

- E01-S87: histórico básico de OS de Sistema e componentes.
- E01-S53: planos, ocorrências, calendário e resultado preventivo.
- E01-S159: cadastro e composição de Sistemas na Visão 360.
- E01-S160: árvore de ativos e comportamento próprio de expansão.
