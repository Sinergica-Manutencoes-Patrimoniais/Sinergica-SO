# Feature Specification: Gatilho único do Auvo — criação manual vira contingência auditada

**Story:** E01-S196 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E01-S196-gatilho-unico-auvo`
**Status:** Especificada — implementação não iniciada. **Tier arquitetural** (integração externa).

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 004** e seção 7.
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

A metade difícil do BL 004 já foi feita: `1844_E01-S168_cron_despacho_t24.sql` e a Edge Function
`pcm-auvo-t24-despachar` criaram o acionador que não existia — antes disso, a resposta para "o que
dispara a orquestração T−24 em produção?" era, nas palavras da própria migration, "literalmente,
nada". Quatro travas seguem fechadas por padrão.

O que **não** foi feito é a outra metade do achado: os **gatilhos concorrentes**. Continuam vivos
`pcm-auvo-create-task` e `pcm-auvo-open-task` — criação imediata e ação manual, caminhos paralelos
ao T−24. Enquanto existirem como caminho normal, "um gatilho" é só intenção.

Regra aprovada: **um gatilho normal** — confirmação do PCM agenda o envio para início da Visita
menos 24 horas; confirmação dentro da janela envia imediatamente. **Cada OS gera exatamente uma
tarefa** no Auvo, com idempotência pelo ID externo. A criação manual **não some**: vira
**contingência auditada**.

## User Scenarios & Testing

### US1 — Um caminho normal, comprovado ponta a ponta (Priority: P1)

**Why this priority:** O pacote pede comprovação de fluxo único, não ausência de bug.

**Independent Test:** Confirmar uma Visita antes de T−24 e outra dentro da janela; conferir que uma
fica programada e a outra sai na hora, e que cada OS tem uma tarefa só.

**Acceptance Scenarios:**

- **AC-1:** Dada uma Visita confirmada **antes** de T−24, quando confirmada, então as tarefas ficam **programadas** para início menos 24 horas, sem envio imediato.
- **AC-2:** Dada uma Visita confirmada **dentro** de T−24, quando confirmada, então o envio ocorre **imediatamente**.
- **AC-3:** Dada uma Visita **não confirmada**, quando a janela passar, então **nenhuma tarefa é gerada** e ela aparece como **exceção** no monitor.
- **AC-4:** Dada uma OS, quando despachada mais de uma vez, então existe **exatamente uma** tarefa no Auvo — garantida pelo ID externo, não por tentativa e erro.

### US2 — Reprogramação atualiza, não duplica (Priority: P1)

**Why this priority:** Duplicar tarefa no Auvo contamina o campo, que é o lado que não controlamos.

**Acceptance Scenarios:**

- **AC-5:** Dada reprogramação **antes** do envio, quando ocorrer, então apenas **recalcula T−24**.
- **AC-6:** Dada reprogramação **depois** do envio, quando ocorrer, então **atualiza a mesma tarefa**, sem criar outra.
- **AC-7:** Dada uma OS que **retorna para Demanda**, quando retornar, então a tarefa existente permanece (atrasada no Auvo) e, no novo planejamento, é **atualizada** — nunca recriada.
- **AC-8:** Dada uma falha de integração, quando ocorrer, então há tentativa automática, alerta e reprocessamento, e o **planejamento local nunca é apagado**.

### US3 — Manual existe, mas é contingência (Priority: P1)

**Why this priority:** É a divergência que sobra; sem fechá-la, o fluxo único não é único.

**Acceptance Scenarios:**

- **AC-9:** Dado o caminho manual de criação de tarefa, quando usado, então exige **capacidade própria**, **motivo registrado** e fica **auditado** como contingência (depende de `E00-S26`).
- **AC-10:** Dado o fluxo normal disponível, quando um escritor tentar criar tarefa fora da confirmação + T−24 **sem** a capacidade de contingência, então é **recusado**.
- **AC-11:** Dado o monitor de exceções, quando aberto, então lista Visita não confirmada, falha de envio, tarefa órfã e **uso de contingência** — as quatro, no mesmo lugar.

### Edge Cases

- Confirmação exatamente no instante T−24 (fronteira precisa ser determinística e documentada).
- Auvo indisponível na hora do despacho: retry sem duplicar.
- Tarefa já concluída no Auvo quando chega a reprogramação.
- Visita cancelada depois do envio.
- Relógio/fuso: a janela é sobre o início da Visita, não sobre o horário do servidor.

## Requirements

### Functional Requirements

- **FR-001:** Tornar confirmação PCM + T−24 o **único** caminho normal de criação de tarefa, conforme AC-1, AC-2, AC-10.
- **FR-002:** Garantir uma tarefa por OS por chave idempotente de ID externo, conforme AC-4.
- **FR-003:** Atualizar tarefa existente em reprogramação e em retorno para Demanda, conforme AC-5, AC-6, AC-7.
- **FR-004:** Preservar planejamento local em qualquer falha, com retry e alerta, conforme AC-8.
- **FR-005:** Converter criação manual em contingência com capacidade, motivo e auditoria, conforme AC-9.
- **FR-006:** Consolidar o monitor de exceções, conforme AC-3, AC-11.

### Key Entities

Nenhuma entidade nova esperada: fila de envio, estado de sincronização e chave idempotente por OS já
existem (`pcm.auvo_sync_outbox`, `auvo_task_id`, `auvo_sync_status`). O que muda é **quem pode
escrever nelas**.

## Success Criteria

- **SC-001:** Teste ponta a ponta cobre antes de T−24, dentro da janela, repetição, timeout, indisponibilidade, reprogramação, cancelamento, retorno atrasado e concorrência.
- **SC-002:** Nenhum caminho cria tarefa fora do fluxo único sem capacidade de contingência.
- **SC-003:** Zero tarefa duplicada em qualquer cenário testado.
- **SC-004:** Uso de contingência visível no monitor e em `audit.*`.

## Assumptions & Dependencies

- Depende de `1844` já aplicado e de **BL 003** (Visita).
- Depende de `E00-S26` para a capacidade de contingência.
- **Exige validação do contrato real da API Auvo** (o pacote pede isso explicitamente; ver `docs/AUDITORIA-AUVO-API.md`).
- Tier arquitetural: ADR + `/revisao-adversarial` antes do PASS.

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

- Trocar o provedor de campo.
- Reescrever a orquestração T−24 (ela existe e está testada; aqui se fecha o cerco em volta).
- Abrir as travas de produção — abertura de gate é assunto de `E01-S188`.
