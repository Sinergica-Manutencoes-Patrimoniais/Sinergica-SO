---
name: design
description: Solução técnica, eixos e trade-offs. Tier arquitetural — aprovar antes de implementar.
alwaysApply: true
---

# Design — Abertura de OS no Auvo sob demanda

> **Decisão difícil de reverter** (desliga trigger que roda em produção + muda o momento de criação
> de task no Auvo) → exige ADR ([ADR-0015](../../docs/adr/0015-abertura-os-auvo-sob-demanda.md)).

## Estado atual (confirmado)
- Trigger `pcm.fn_auvo_create_task_on_planejamento` cria a task no Auvo quando o status da OS vira
  `planejamento` (referenciado em `domain/ordens-servico.ts` L193-196). A lógica de montar a task e
  chamar o Auvo vive em `supabase/functions/_shared/auvo/os-from-task.ts` (`criarOsDaTarefa`) e no
  push `pcm-auvo-push`.
- Criar via `abrirOrdemServico` **não** dispara Auvo — só a transição pra `planejamento` (via trigger).

## Solução proposta
Mover a decisão de criar a task do **banco (automático)** para a **aplicação (ação do usuário)**,
com dry-run obrigatório antes.

1. **Desligar o automático** — migration que **remove/desativa** o trigger
   `fn_auvo_create_task_on_planejamento` (mantém a função utilitária de montagem de payload, que
   passa a ser chamada pela ação explícita). Legado não é afetado (tasks já criadas continuam).
2. **Edge Function de abertura com `dryRun`** — expor a criação de task como uma função invocável
   pela UI (ex.: `pcm-auvo-open-task`), com dois modos:
   - `dryRun: true` → monta e retorna o payload **sem** chamar o Auvo (cliente Auvo id, tipo
     tarefa, técnico, data, orientação, endereço/local, prioridade). Não grava nada.
   - `dryRun: false` → cria de fato, grava `auvoTaskId` na OS, idempotente (se já tem task, retorna
     a existente sem criar outra).
3. **UI — dois gatilhos:**
   - Ao mover um card pra **Planejamento**: modal "Abrir OS no Auvo?" que primeiro roda o dry-run e
     mostra os campos; operador confirma → cria; ou recusa → a OS fica em Planejamento **sem** task
     (pode abrir depois pelo botão).
   - Botão **"Abrir OS Auvo"** no painel do Chamado/OS (`ChamadoPainel`/`DetalheOs`), visível quando
     `auvoTaskId === null`: mesmo dry-run → confirma → cria.

## 5 eixos
- **Dados:** sem tabela nova. Migration só mexe no trigger. `auvoTaskId` continua sendo o registro
  de "já foi pro Auvo".
- **Segurança:** a Edge Function exige claim de escrita PCM (mesma guarda das outras `pcm-auvo-*`),
  service_role só no servidor; dry-run não expõe segredo (só campos de negócio).
- **Performance:** dry-run é 1 round-trip sem efeito colateral; criação idempotente evita retrabalho.
- **Erro/resiliência:** falha ao criar no Auvo não muda o status da OS no PCM (já está em
  Planejamento); vira "sync pendente" (E01-S123) e o botão continua disponível pra retentar. Sem
  criação silenciosa.
- **Observabilidade:** cada abertura confirmada registra em `audit`/`auvo_entity_status`; a Saúde
  Auvo (E01-S123) mostra pendências.

## Alternativas consideradas
- **A) Manter o trigger, só adicionar confirmação na UI** — rejeitada: o trigger é no banco, a UI não
  consegue interceptá-lo; a criação aconteceria de qualquer jeito na transição de status.
- **B) Flag de config "auto on/off"** — rejeitada por ora: o pedido é explícito (desligar o
  automático), não configurável; menos superfície.
- **C escolhida) Trigger removido + criação explícita com dry-run** — alinha o momento de criação ao
  controle humano; reversível via novo trigger se um dia quiser voltar (documentado no ADR).

## Riscos
- Alguma outra parte do sistema depender do trigger pra criar task (ex.: fluxo Zé/WhatsApp,
  portal). **Auditar todos os produtores de task Auvo antes de remover o trigger** (Edge Functions
  `pcm-ze-agent`, webhook, portal) — se algum conta com a criação automática ao planejar, migrar
  também pro caminho explícito ou manter um caminho server-side dedicado.
- Deno/Auvo não testáveis localmente (sem Deno CLI) — validar no CI/produção com cuidado.
