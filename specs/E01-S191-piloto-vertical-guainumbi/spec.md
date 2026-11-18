# Feature Specification: Jornada vertical do piloto — Guainumbi ponta a ponta

**Story:** E01-S191 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-13
**Feature Branch (planejada):** `feat/E01-S191-piloto-vertical`
**Status:** Especificada — implementação não iniciada.

**Input:** Reanálise do Fabrício de 12/11/2026, seção 8 ("Proposta de piloto controlado"), seção 11 ("Critérios para considerar uma história concluída") e risco 3.

## Contexto — o problema que esta story resolve

Toda a prova do programa hoje é pgTAP, teste de componente e unitário. **Nenhuma demonstra a
jornada completa com dados reais controlados.** É o risco 3 da reanálise, e é o que sustenta a
diferença entre "70–75% de código preparado" e "35–45% utilizável".

O Fabrício é explícito sobre o próximo marco: *"não deve ser mais código incorporado, mas uma
demonstração no Guainumbi com migrations aplicadas, gates mínimos, rollback, Visita, duas OS,
Auvo, retorno e validação PCM."*

Esta story entrega **a prova automatizada dessa jornada**, nas nove etapas que ele listou, mais o
roteiro reproduzível para a demonstração assistida.

## User Scenarios & Testing

### US1 — A jornada de nove etapas roda ponta a ponta (Priority: P1)

**Why this priority:** É o marco que o cliente definiu. Sem ele, nenhuma story do programa é "concluída" pelo critério dele.

**Independent Test:** Rodar o E2E num ambiente com Cliente de teste e confirmar que as nove etapas passam, com evidência de cada uma.

**Acceptance Scenarios:**

- **AC-1:** Dada a estrutura do Cliente — Área, Local, Sistema e equipamento ou componente —, quando percorrida, então todos existem, estão vinculados e a árvore navega nos dois eixos (por Local e por Sistema), sem duplicidade.
- **AC-2:** Dado um Plano vigente com uma Rotina e um alvo, quando gerar ocorrências, então a geração respeita o modo (calendário ou Visita) e a **regra de feriado** — feriado no dia contratual elimina a Visita da semana sem repor; vencimento por calendário em feriado fica pendente ao PCM.
- **AC-3:** Dada uma Ocorrência, quando o PCM promovê-la, então nasce um Chamado preventivo vinculado à origem, sem conversão destrutiva.
- **AC-4:** Dado o Chamado preventivo, quando gerar duas OS para ele, então as duas coexistem, com números distintos, e **o Chamado continua aberto** — é a prova da jornada que a migration 1842 destravou.
- **AC-5:** Dadas as duas OS, quando agrupá-las numa Visita do Cliente com equipe e horário, então a Visita lista as duas e a agenda mostra a alocação correspondente.
- **AC-6:** Dada a Visita confirmada dentro da janela, quando o despacho ocorrer, então sai **uma tarefa por OS** e a reprogramação atualiza a mesma tarefa, nunca cria outra.
- **AC-7:** Dado o retorno do campo, quando chegar, então resultados, evidências e status são aplicados **sem duplicar** e sem fechar o Chamado automaticamente.
- **AC-8:** Dada a execução concluída, quando o PCM validar, então encerra **cada OS individualmente** e o Chamado só encerra com escopo integral resolvido.

### US2 — A demonstração é reproduzível e reversível (Priority: P1)

**Why this priority:** O critério de conclusão do cliente exige rollback testado, não só o caminho feliz.

**Independent Test:** Executar abertura, jornada e retorno em sequência, e confirmar que o ambiente volta ao estado inicial sem perder o que foi produzido.

**Acceptance Scenarios:**

- **AC-9:** Dado o roteiro do piloto, quando executado do zero, então produz a mesma sequência de evidências — versão, ambiente, executor, data, identificadores, resultados — sem edição manual direta no banco em nenhum passo.
- **AC-10:** Dada a jornada concluída, quando executar o retorno dos gates, então o sistema volta ao estado anterior de ativação e **os dados produzidos permanecem**, íntegros e consultáveis.

### Edge Cases

- Reexecutar o E2E não pode depender de limpeza manual: ou isola por Cliente de teste descartável, ou é idempotente por identificador.
- Etapa 7 (Auvo) depende de contrato comprovado; enquanto 16.2-1 estiver pendente, essa etapa roda contra um duplo de teste e fica **explicitamente marcada** como não comprovada contra o Auvo real.
- Falha no meio da jornada precisa dizer **em qual etapa** parou, com o identificador do objeto — é o que torna a evidência útil.
- Feriado móvel e virada de ano na geração de ocorrências.

## Requirements

### Functional Requirements

- **FR-001:** Cobrir as nove etapas do piloto em teste automatizado de ponta a ponta, conforme AC-1 a AC-8.
- **FR-002:** Produzir, a cada execução, o registro de evidências exigido pelo critério de conclusão do cliente, conforme AC-9.
- **FR-003:** Demonstrar o retorno dos gates sem perda de dado, conforme AC-10.
- **FR-004:** Isolar a execução em Cliente de teste; nenhuma etapa toca dado de Cliente real.
- **FR-005:** Marcar explicitamente toda etapa cuja prova dependa de duplo de teste em vez do sistema externo real.

### Key Entities

Sem entidade nova. **Roteiro do piloto** é artefato executável, não documento. **Registro de
evidência** acompanha cada execução e é o que vai ao aceite.

## Success Criteria

- **SC-001:** As nove etapas passam numa execução única, em ambiente limpo, sem intervenção manual.
- **SC-002:** A execução produz evidência suficiente para o aceite do critério 11 da reanálise.
- **SC-003:** Abertura e retorno de gates são demonstrados na mesma execução.
- **SC-004:** O relatório da execução diz, sem ambiguidade, quais etapas foram provadas contra sistema real e quais contra duplo.

## Assumptions & Dependencies

- Depende de E01-S188 para abrir e fechar gates por procedimento (AC-10).
- A etapa 7 contra o **Auvo real** depende de 16.2-1 — prova de contrato com credencial real. Sem ela, a etapa roda contra duplo e fica marcada.
- Existe base de E2E em `apps/web/e2e/`; esta story estende, não funda.

## Alcance no front — obrigatório nesta story

Regra transversal criada em 17/11/2026. Medição que a motiva:
`docs/Apontamentos/alcance-no-front-2026-11-17.md` — **694** flags `VITE_SSO_*` usadas e nunca
declaradas, **227** `return null` silenciosos, **583** gates `default false` contra **1** migration
que já abriu algum. O efeito medido: regra fechada em produção (Chamado 1:N, `1842`) e **nenhum
botão** na tela.

**Esta story não está concluída quando o pgTAP passa. Está concluída quando o operador alcança a
ação na tela.** Os critérios abaixo valem como AC e entram no Definition of Done do PR:

- **AC-F1:** Toda capacidade entregue tem UI alcançável por um perfil real, com o **caminho de navegação nomeado** (menu → tela → ação) no `plan.md`.
- **AC-F2:** Toda flag `VITE_SSO_*` introduzida ou usada é **declarada no mesmo PR** em `.env.example` e `netlify.toml`, com valor explícito — `false` quando a decisão é continuar desligada.
- **AC-F3:** Recurso desligado por flag ou gate mostra o estado **"disponível, não ativado"**; `return null` silencioso é recusado no review (padrão definido em `E00-S28`).
- **AC-F4:** Todo gate de banco novo nasce com **procedimento de abertura e de retorno** escritos no `plan.md`, antes de existir.
- **AC-F5:** O PR declara em **uma linha** o que falta para a jornada ficar utilizável em produção (flag, gate, grant) — ou afirma que já está utilizável.

## Fora de escopo

- Executar o piloto com Cliente real em produção — isso é ato operacional, não entrega de código.
- A matriz CT001–030 completa de homologação por onda (E01-S186 US2).
- Comprovar o contrato do Auvo; é pré-requisito externo.
