# Feature Specification: Backlog como escopo validado que antecede Chamado e OS

**Story:** E01-S193 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-17
**Feature Branch (planejada):** `feat/E01-S193-backlog-antecede-chamado`
**Status:** Especificada — implementação não iniciada. **Tier arquitetural** (dado em produção).

**Input:** Pacote Consolidado SSO v1.0 (13/11/2026), **BL 002** e seção 3.
Confronto em `docs/Apontamentos/Pacote-Consolidado-2026-11-13-confronto.md`.

## Contexto — o problema que esta story resolve

Existem **dois Backlogs** no sistema:

1. **O legado:** Backlog é um **status da OS** — `pcm.ordens_servico.status='backlog'`,
   `STATUS_OS` em `apps/web/src/features/pcm/domain/ordens-servico.ts:127`, hardening em
   `0020_E01-S20_os_backlog_operacional.sql`. É este que a tela "Backlog GUT" e o Kanban consomem
   hoje, e é exatamente a evidência do Fabrício: "Backlog descrito como *OS abertas priorizadas*
   com ações *Confirmar chamado* e *Planejar*".
2. **O aprovado, já parcialmente construído:** `pcm.sso_backlog_parcelas` com coluna `origem`
   (1218, 1219, 1830 de `E01-S167`), que já trata o item de Backlog como escopo, não como OS.

A regra aprovada inverte a ordem do legado: **Pendência → item de Backlog → (seleção do PCM) →
Chamado → Demanda → OS**. Backlog contém escopo **validado e priorizável mas sem compromisso de
execução**; criar OS antes disso é o erro. E só entra no Backlog o que o PCM escolheu — item sem
intenção de tratamento não polui a fila.

Nenhuma OS existente é apagada. A transição segue o padrão de `1842`: aditiva, com gate fechado por
padrão e corte reproduzível em migration.

## User Scenarios & Testing

### US1 — Pendência vira item de Backlog sem virar OS (Priority: P1)

**Why this priority:** É a inversão que corrige o conceito; tudo o mais depende dela.

**Independent Test:** Selecionar pendências de um cliente, mandá-las para o Backlog, e confirmar que
**nenhuma OS e nenhum Chamado** foram criados.

**Acceptance Scenarios:**

- **AC-1:** Dadas pendências validadas, quando o PCM selecionar um subconjunto e enviar ao Backlog, então nasce **um item de Backlog agrupado**, com origem e histórico de cada pendência preservados — e **zero** OS ou Chamado criados.
- **AC-2:** Dadas pendências **não** selecionadas, quando a operação ocorrer, então elas **mantêm a situação anterior** e não aparecem no Backlog.
- **AC-3:** Dado um item de Backlog, quando priorizado por **GUT**, então a priorização é do item de Backlog, não de uma OS.

### US2 — A seleção do PCM é que cria o Chamado (Priority: P1)

**Why this priority:** É onde o compromisso de execução nasce; antes disso não deve existir registro executável.

**Acceptance Scenarios:**

- **AC-4:** Dado um item de Backlog priorizado, quando o PCM liberar escopo para execução, então é criado **um Chamado** no estado **Demanda**, vinculado ao item de origem — e só então o Chamado admite OS.
- **AC-5:** Dado escopo liberado parcialmente, quando só parte do item for ao Chamado, então o **restante continua no Backlog** com origem e histórico intactos.
- **AC-6:** Dado um escopo postergado por prazo longo, quando devolvido, então **volta ao Backlog com motivo registrado** e histórico preservado (reusa `1830_E01-S167_devolucao_escopo_backlog.sql`; não reimplementar).

### US3 — O Backlog legado some sem perder dado (Priority: P1)

**Why this priority:** Conviver com dois Backlogs é pior que qualquer um dos dois sozinho.

**Acceptance Scenarios:**

- **AC-7:** Dadas as OS hoje em `status='backlog'`, quando a transição for aplicada, então cada uma é **classificada por decisão explícita** — vira item de Backlog ou permanece OS com estado próprio —, **nunca apagada** e sempre auditada.
- **AC-8:** Dado o gate da transição fechado, quando qualquer escritor tentar criar OS em `status='backlog'`, então é recusado com erro nomeado — e com o gate aberto o caminho antigo deixa de existir.

### Edge Cases

- Item de Backlog cuja pendência de origem é reaberta em campo.
- Duas sessões do PCM liberando o mesmo item ao mesmo tempo (concorrência otimista obrigatória).
- Item de Backlog de cliente que encerrou contrato.
- OS legada em `status='backlog'` já com `auvo_task_id` — não pode ser reclassificada sem reconciliação (mesmo padrão de `E01-S171`/`1832`).

## Requirements

### Functional Requirements

- **FR-001:** Converter pendências selecionadas em item de Backlog agrupado, preservando origem, conforme AC-1, AC-2.
- **FR-002:** Priorizar por GUT no item de Backlog, conforme AC-3.
- **FR-003:** Criar Chamado em Demanda **apenas** na liberação do PCM, conforme AC-4, AC-5.
- **FR-004:** Reusar a devolução de escopo existente, conforme AC-6.
- **FR-005:** Executar a transição do Backlog legado de forma aditiva, gate fechado por padrão e auditada, conforme AC-7, AC-8.
- **FR-006:** Toda operação de conversão é **transacional** (`do $$ ... $$` quando precisar de atomicidade — a GitHub Integration do Supabase roda migration fora de transação).

### Key Entities

**Item de Backlog** (agrupador de pendências, com origem, GUT e situação) — provavelmente
consolidação de `pcm.sso_backlog_parcelas`, não tabela nova. **Chamado** ganha o estado **Demanda**
(ver `E01-S194`). **Pendência** e **OS** não mudam de forma.

## Success Criteria

- **SC-001:** pgTAP prova permitido e negado para cada transição, com RLS FORCE.
- **SC-002:** Nenhuma OS criada no caminho Pendência → Backlog.
- **SC-003:** Nenhum registro legado perdido na transição; relatório antes/depois confere.
- **SC-004:** Concorrência coberta: duas liberações simultâneas do mesmo item não geram dois Chamados.

## Assumptions & Dependencies

- Depende de **BL 001** já fechado (`1842`) — Chamado 1:N OS existe.
- `E01-S194` (Kanban) depende desta.
- Exige ADR + `/revisao-adversarial` antes do PASS.
- Migration numerada em sequência, sem pular (`db/README.md`).

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

- Reorganizar as colunas do Kanban — é `E01-S194`.
- Indicador de pressão do Backlog × capacidade — anexo **Em validação**, não implementar.
- Alterar a regra de GUT em si.
