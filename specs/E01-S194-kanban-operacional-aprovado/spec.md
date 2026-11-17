# Feature Specification: Kanban operacional aprovado — Campo a conciliar, Demanda e Validação PCM

**Story:** E01-S194 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E01-S194-kanban-operacional-aprovado`
**Status:** Especificada — implementação não iniciada.

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 007** e seção 4.
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

O Kanban de hoje, em `apps/web/src/features/pcm/domain/kanban-colunas.ts`, é
`solicitacao · corretiva · backlog · preventiva · planejamento · em_execucao · finalizado · cancelado`
— e cada coluna é um **status de OS**, não uma etapa de tratamento.

O fluxo aprovado é:

```
Solicitações | Preventivas | Campo a conciliar | Demanda | Planejamento | Em execução | Validação PCM | Finalizado
```

com **Backlog em painel lateral priorizado** (não etapa) e **Cancelado como filtro e histórico**
(não coluna cotidiana). As três primeiras são **filas de entrada**; as demais são **etapas de
tratamento**.

Diferenças concretas: faltam **Campo a conciliar**, **Demanda** e **Validação PCM**; sobram
`corretiva` e `backlog` como colunas; `cancelado` sai de coluna.

Nem tudo é novo. **Validação PCM já tem mecânica** — `0560_E01-S168_validacao_pcm_resposta.sql`,
`0348`, `0527`, `0550`. **Campo a conciliar** também tem base: OS aberta no Auvo sem ID de Chamado
já cria OS e Chamado provisórios (`1420`/`1429` de `E01-S167`). O que falta é **virarem etapa
visível** no quadro. Não reimplementar as regras.

## User Scenarios & Testing

### US1 — O quadro mostra as etapas aprovadas (Priority: P1)

**Why this priority:** O Kanban é a tela onde o PCM decide o dia; errada, ela ensina o conceito errado.

**Independent Test:** Abrir o Kanban e conferir as oito colunas na ordem aprovada, sem `corretiva` e
sem `backlog` como coluna.

**Acceptance Scenarios:**

- **AC-1:** Dado o Kanban, quando aberto, então exibe exatamente `Solicitações · Preventivas · Campo a conciliar · Demanda · Planejamento · Em execução · Validação PCM · Finalizado`, nessa ordem.
- **AC-2:** Dado um item cancelado, quando o usuário procurar, então ele é **consultável por filtro e histórico**, e **não** ocupa coluna no quadro cotidiano.
- **AC-3:** Dado o Backlog, quando o Kanban abrir, então aparece em **painel lateral priorizado**, e **não duplica cartões** que já estão em etapa de tratamento.

### US2 — Entradas preservam a origem (Priority: P1)

**Why this priority:** Misturar origem com etapa é a causa raiz do quadro atual.

**Acceptance Scenarios:**

- **AC-4:** Dado um item em Solicitações, Preventivas ou Campo a conciliar, quando avançar para Demanda, então a **origem permanece registrada e visível** depois da entrada.
- **AC-5:** Dada uma OS vinda do Auvo sem ID de Chamado, quando chegar, então aparece em **Campo a conciliar** com o Chamado provisório já existente (reusa 1420/1429), não numa coluna genérica.
- **AC-6:** Dada uma preventiva do período, quando listada, então aparece na fila **Preventivas** para planejamento, sem virar Chamado automaticamente.

### US3 — Transições respeitam a regra, não o arrasto (Priority: P1)

**Why this priority:** O quadro não pode permitir estado que o domínio recusa.

**Acceptance Scenarios:**

- **AC-7:** Dado um arrasto para uma etapa não permitida, quando solto, então a transição é **recusada no servidor** e o cartão volta — a validação não vive só no cliente.
- **AC-8:** Dado um retorno de execução do Auvo, quando chegar, então a OS vai para **Validação PCM** e o Chamado **não** é encerrado automaticamente.
- **AC-9:** Dado um Chamado adiado por curto prazo, quando adiado, então **retorna para Demanda**; se for prazo longo, o escopo volta ao Backlog com motivo (comportamento de `E01-S193`).
- **AC-10:** Dado um usuário sem a capacidade `validar`, quando tentar mover para Finalizado a partir de Validação PCM, então é recusado (depende de `E00-S26`).

### Edge Cases

- Duas sessões movendo o mesmo cartão simultaneamente.
- Chamado com OS em etapas diferentes: o cartão do Chamado precisa mostrar etapa mista sem mentir (já existe `1039`/`1510` — quadro gerencial e inconsistência por item).
- Preferência de coluna salva antes desta mudança (`normalizarColunasKanban` já reconcilia; conferir que não ressuscita `corretiva`/`backlog`).
- Item de Backlog que já virou Chamado não pode continuar no painel lateral.

## Requirements

### Functional Requirements

- **FR-001:** Redefinir as colunas e a ordem aprovadas, conforme AC-1.
- **FR-002:** Tirar `cancelado` de coluna e expô-lo como filtro/histórico, conforme AC-2.
- **FR-003:** Expor Backlog como painel lateral sem duplicar cartão, conforme AC-3.
- **FR-004:** Introduzir **Demanda** e **Validação PCM** como etapas explícitas, reusando a mecânica existente, conforme AC-8, AC-9.
- **FR-005:** Introduzir **Campo a conciliar** como fila de entrada ligada à conciliação já existente, conforme AC-5.
- **FR-006:** Validar transição no servidor, conforme AC-7, AC-10.
- **FR-007:** Migrar preferências de coluna salvas sem ressuscitar coluna extinta.

### Key Entities

Nenhuma entidade nova. Estados de **Chamado** ganham `demanda`; estados de **OS** ganham
`validacao_pcm` e `campo_a_conciliar`. Atenção: `pcm.ordens_servico.status` é `text` **sem CHECK**
(`0001_E00-S00_schemas_dominio.sql:68`) — acrescentar estado é barato no schema e **por isso
perigoso**: a guarda tem que ser explícita, não presumida.

## Success Criteria

- **SC-001:** pgTAP cobre cada transição permitida e cada recusada.
- **SC-002:** Nenhum cartão duplicado entre painel lateral e colunas.
- **SC-003:** Retorno do Auvo nunca encerra Chamado sozinho.
- **SC-004:** Preferência antiga de coluna é reconciliada sem perda.

## Assumptions & Dependencies

- **Depende de `E01-S193`** (Backlog antecede Chamado) e de `E00-S26` (capacidade `validar`).
- Depende de **BL 001** já fechado (`1842`).
- Não depende de credencial externa.

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

- Redesenho visual do cartão.
- Alterar a regra de retorno do Auvo (já existe em `E01-S168`).
- Cockpit e indicadores — **Próxima rodada** no pacote.
