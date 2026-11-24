---
name: spec
description: "Monitor consolidado de exceções do Auvo em T−24 — fecha o critério de BL 004 que E01-S196 deixou como SPEC_DEVIATION."
alwaysApply: false
---

# E01-S201 — Monitor consolidado de exceções do Auvo (T−24)

## Por que esta story existe

O Pacote Consolidado (Fabrício, 13/11/2026), **BL 004 — "Unificar o envio ao Auvo em T menos 24"**,
manda, literalmente:

> "Módulo e tela: Integrações, Planejamento e **monitor de exceções**."
> "Visita não confirmada não gera tarefas e **aparece como exceção**."
> "Falhas de integração possuem tentativas automáticas, alerta, reprocessamento e **nunca apagam o
> planejamento local**."
> Critérios: "comprovar envio único; atualizar data sem duplicidade; reprocessar falha; **registrar
> ID externo, tentativas e erro**; permitir contingência manual auditada."

`E01-S196` entregou o resto do BL 004 e registrou o buraco: a migration `1863` expõe só a leitura
de **contingência**, e seu próprio comentário diz que "as outras três (Visita não confirmada, falha
de envio, tarefa órfã) não têm consulta consolidada ainda". Em 24/11 o cliente cobrou exatamente
isso. Esta story fecha o ponto.

## Achado que define o escopo

**As três informações já existem no banco, separadas, e nada as reúne.** Hoje, para saber se uma
Visita ficou sem tarefa, alguém precisa olhar em três lugares diferentes e cruzar na cabeça. O
inventário completo (tabela, coluna, RPC de cada família) está em `plan.md`; o resumo:

| Família | Onde mora hoje | Havia consulta? |
|---|---|---|
| Falha de envio | `pcm.sso_t24_tentativas.estado in ('bloqueado','incerto','reconciliacao')` + último `pcm.sso_t24_tentativa_eventos.motivo` + `pcm.auvo_sync_outbox` | Não |
| Visita não confirmada | `pcm.visitas.estado` + `pcm.visita_ordens_servico` — a exceção é a **ausência** de tentativa | Não. Não havia nem onde ser lida |
| Tarefa órfã | `pcm.sso_origem_campo_processamentos.provisorio` (1420), sem decisão de triagem (1428) | Sim — `pcm.sso_listar_campo_a_conciliar` (1866), reusada aqui |

Logo esta story **não constrói motor nenhum**: acrescenta a consulta que faltava e a tela que a
lê, reusando gate e capacidade que já existem.

## Acceptance Criteria

- **AC-1:** uma única consulta devolve as três famílias no mesmo resultado, cada linha dizendo a
  que família pertence.
- **AC-2:** cada linha traz Cliente, Visita e/ou OS envolvida, identificador externo (task id do
  Auvo), número de tentativas, último erro e quando ocorreu.
- **AC-3:** "falha de envio" é a tentativa T−24 parada em `bloqueado`, `incerto` ou
  `reconciliacao`; tentativa confirmada ou cancelada **não** é exceção.
- **AC-4:** "Visita não confirmada" é a Visita com OS vinculada vigente cuja janela T−24 já abriu e
  que não foi confirmada — uma linha por OS que deixou de virar tarefa. Visita fora da janela ou já
  confirmada não entra.
- **AC-5:** "tarefa órfã" é a OS vinda do Auvo sem Chamado, ainda não conciliada — **mesmo recorte**
  de `pcm.sso_listar_campo_a_conciliar`, chamado por reuso, nunca reescrito.
- **AC-6:** exceção de um Cliente nunca aparece na consulta de outro.
- **AC-7:** a consulta é **só leitura** — não escreve, não reprocessa, não apaga planejamento local.
- **AC-8:** gate fechado recusa com erro nomeado (`consulta_desabilitada`), não com lista vazia nem
  `permission denied`.
- **AC-9:** sem a capacidade exigida, recusa com `sem_acesso`.
- **AC-10:** flag desligada, gate fechado, falta de capacidade, falta de Cliente e "nenhuma exceção"
  produzem frases **diferentes** na tela. Num monitor de exceções, silêncio por recurso apagado
  parece saúde — é o engano mais caro possível.
- **AC-11:** nenhum gate e nenhuma capacidade novos: reusa `pcm.sso_consulta_estado_campo_gate` e
  `execucao.validar`.

## Alcance no front — obrigatório nesta story

- **AC-F1:** caminho nomeado — PCM → OPERAÇÃO → **"Monitor Auvo (T−24)"**, com um Cliente
  selecionado no filtro da própria tela.
- **AC-F2:** `VITE_SSO_MONITOR_EXCECOES_AUVO_ENABLED` declarada no registro de flags, em
  `.env.example` e em `netlify.toml`, com valor explícito `false`.
- **AC-F3:** recurso desligado mostra "disponível, ainda não ativado" — `return null` silencioso é
  recusado no review.
- **AC-F4:** dado de servidor só por TanStack Query, com `retry: false` (gate fechado e falta de
  capacidade são erros permanentes).
- **AC-F5:** o PR declara em uma linha o que falta para a jornada ficar utilizável.

## Success Criteria

- **SC-001:** pgTAP prova permitido **e** negado, incluindo gate fechado com erro nomeado.
- **SC-002:** cada família tem pelo menos um caso que entra e um que **não** entra, provado por
  teste e não por leitura.
- **SC-003:** nenhum Cliente enxerga exceção de outro.

## Fora de escopo

- **Reprocessar falha.** É ação (escrita, idempotência, auditoria) e fica para a fatia seguinte;
  registrado em `tasks.md`. Botão que não faz nada seria pior que botão nenhum.
- Criar gate, capacidade, tabela ou coluna nova.
- Consolidação multi-Cliente numa chamada só: a capacidade é por Cliente, como em 1427/1428/1866.
- Reescrever o recorte de "tarefa órfã" — ele continua tendo **uma** definição, em `1866`.
- Alerta ativo (e-mail/WhatsApp) sobre exceção: o pacote cita "alerta", mas isso é canal, não tela.
