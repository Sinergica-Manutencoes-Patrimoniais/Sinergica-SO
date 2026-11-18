# Feature Specification: Pendências técnicas agrupadas por ativo, sem perder o achado individual

**Story:** E01-S197 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E01-S197-pendencias-agrupadas-ativo`
**Status:** Especificada — implementação não iniciada.

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 008** e seções 2 e 3.
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

Pendência tem bastante código: 18 migrations entre `E01-S173`, `E01-S174` e `E01-S183` — composição
(0375), vínculo com parcela (0441), contexto técnico (0597), rastreabilidade (0669), publicação
(0487). E existe **filtro** por ativo (`1097_E01-S173_filtro_ativo_paginado.sql`).

O que o pacote pede é diferente de filtro: **agrupamento**. Cada achado continua preservado
individualmente, mas a **visualização** é por equipamento, Sistema ou objeto técnico. O AC que o
Fabrício escreveu é literal: sete achados no mesmo quadro aparecem em **um cartão com sete
pendências**; o PCM envia **duas** ao Backlog e as **cinco** restantes conservam sua situação.

As regras de origem também precisam ficar explícitas no fluxo:

- preventiva executada como **Não OK** é **concluída** e **gera pendência** — a falha não mantém a
  preventiva aberta;
- uma falha **não cria** Chamado nem OS automaticamente;
- resultados possíveis: **OK, Não OK, Não aplicável, Corrigido**.

## User Scenarios & Testing

### US1 — Um cartão, vários achados (Priority: P1)

**Why this priority:** É o AC que o cliente escreveu; é o teste de aceitação da story.

**Independent Test:** Lançar sete achados Não OK no mesmo quadro elétrico e abrir a Central de Pendências.

**Acceptance Scenarios:**

- **AC-1:** Dados sete achados no mesmo equipamento, quando listados, então aparecem como **um cartão agrupado com sete pendências**, cada uma com sua evidência e sua situação própria.
- **AC-2:** Dado esse cartão, quando o PCM enviar **duas** pendências ao Backlog, então as outras **cinco conservam a situação anterior** — nada é arrastado junto.
- **AC-3:** Dado o agrupamento, quando o usuário trocar o eixo, então a mesma base agrupa por **equipamento**, por **Sistema** ou por **objeto técnico**, sem duplicar achado.

### US2 — Resultado de preventiva fecha a preventiva (Priority: P1)

**Why this priority:** Manter preventiva aberta por causa de falha é a regra errada que o pacote corrige.

**Acceptance Scenarios:**

- **AC-4:** Dada uma preventiva com resultado **Não OK**, quando concluída, então a **preventiva é concluída** e **nasce pendência técnica** vinculada à resposta e ao ativo.
- **AC-5:** Dada a mesma falha, quando registrada, então **nenhum Chamado e nenhuma OS** são criados automaticamente.
- **AC-6:** Dados os resultados **OK**, **Não aplicável** e **Corrigido**, quando registrados, então **não** geram pendência.
- **AC-7:** Dada uma pendência gerada, quando consultada, então é rastreável até a **resposta do questionário**, o **ativo** e a **Visita/OS** de origem.

### US3 — Só o escolhido avança (Priority: P1)

**Why this priority:** É o mesmo princípio do Backlog: item sem intenção de tratamento não polui a fila.

**Acceptance Scenarios:**

- **AC-8:** Dado um conjunto de pendências, quando o PCM selecionar parte, então **apenas a selecionada** entra no Backlog (comportamento de `E01-S193`, não reimplementar).
- **AC-9:** Dada uma pendência reaberta por achado de campo (material faltante ou incorreto), quando reaberta, então **atualiza a pendência existente** em vez de criar outra.

### Edge Cases

- Achado em **Grupo quantitativo** (sem TAG individual) — o agrupamento precisa funcionar sem ativo individual.
- Achado em Componente cujo Equipamento-pai foi movido depois (`0256_E01-S176_mover_componente.sql`).
- Mesmo achado reportado em duas preventivas seguidas: deduplicar sem apagar histórico.
- Ativo desativado com pendência aberta.

## Requirements

### Functional Requirements

- **FR-001:** Agrupar pendências por ativo/Sistema/objeto técnico preservando o achado atômico, conforme AC-1, AC-3.
- **FR-002:** Permitir seleção parcial sem efeito colateral nas não selecionadas, conforme AC-2, AC-8.
- **FR-003:** Concluir a preventiva em Não OK e gerar pendência, conforme AC-4, AC-6.
- **FR-004:** Não criar Chamado nem OS automaticamente a partir de falha, conforme AC-5.
- **FR-005:** Preservar rastreabilidade resposta → ativo → origem, conforme AC-7.
- **FR-006:** Reabrir/atualizar pendência existente a partir de achado de campo, conforme AC-9.

### Key Entities

Nenhuma entidade nova: **pendência atômica** já existe. O que entra é **consulta de agrupamento**
(e, se necessário, um agrupador de visualização que **não** substitui a pendência individual).

## Success Criteria

- **SC-001:** O cenário "7 achados, 2 ao Backlog, 5 conservadas" passa como teste automatizado.
- **SC-002:** Nenhum dos quatro resultados além de Não OK gera pendência.
- **SC-003:** Nenhuma falha cria Chamado ou OS.
- **SC-004:** Agrupamento funciona para Grupo quantitativo, sem TAG individual.

## Assumptions & Dependencies

- Depende da biblioteca de questionários e da estrutura técnica existentes.
- Depende de `E01-S193` para o destino (Backlog).
- A **modelagem final** Equipamento × Componente × Grupo quantitativo está **Em validação** no pacote: esta story **consome** a estrutura atual, não a redefine.

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

- Redefinir Equipamento/Componente/Grupo quantitativo (anexo em validação).
- Publicação de pendência para o cliente (já existe em `E01-S183`).
- Priorização GUT (é `E01-S193`).
