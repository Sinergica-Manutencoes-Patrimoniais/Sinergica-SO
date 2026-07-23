---
name: design-E01-S88-chamados-entidade
description: Design — Chamado (CH) como entidade própria do PCM, semeada da estrutura de pcm.tickets mas desacoplada do sync de ticket Auvo; tela de criação + cancelamento; futura exposição no Portal do Cliente.
alwaysApply: false
---

# Design — Chamados (CH) como entidade própria

> **Tier arquitetural.** Nova fronteira de entidade + fluxo. Aprovar antes de implementar.

## Problema
Fabrício **não usa a estrutura de "ticket" do Auvo**. Quer usar **Chamados (CH-XXXX)** como o
registro de **tudo que ainda não é OS** — solicitações do cliente, itens de inspeção enviados ao
backlog — cada um com **ID rastreável**. Um Chamado pode **originar uma OS**. Falta hoje: uma
entidade Chamado de verdade (hoje `CH-XXXX` é só numeração espalhada), tela de criação, fluxo de
cancelamento e futura exposição no **Portal do Cliente**.

## Decisão do PO (2026-07-20)
> "Utiliza a base do Auvo, pois já deve ter colunas úteis, mas **desassocie do Auvo**, da parte de
> ticket. Chamados deverão ter informações (inclusive criaremos a tela para nós criar e depois vai
> morar também na aba Portal do Cliente) que são pertinentes aos sistemas e aberturas de solicitações."

## Contexto atual (AS-IS)
- `pcm.tickets` existe, **sincronizada do Auvo** (descriptor `/tickets`, `webhookEntity:62`,
  E01-S33). Página `TicketsPage.tsx`.
- Numeração `CH-XXXX` já aparece em fluxos (Zé E01-S02, abertura manual E01-S18, inspeção E01-S19) —
  mas não há entidade Chamado unificada.
- OS em `pcm.ordens_servico`.

## Decisões
### D1 — Nova tabela `pcm.chamados`, semeada do schema de `pcm.tickets`
Criar `pcm.chamados` reusando as **colunas úteis** de `pcm.tickets` (título, descrição, cliente,
status, datas, solicitante), **sem** o acoplamento de sync Auvo. `pcm.tickets` permanece (dado
histórico do Auvo) mas **deixa de ser a estrutura de "Chamado"** na UI — Ticket sai da navegação
operacional (a parte de ticket não é usada, coerente com E01-S80).

### D2 — Chamado é o "item de trabalho pré-OS" rastreável
Um Chamado tem `numero` (`CH-XXXX`, numeração única e sem race — usar sequence/estratégia atômica,
corrigindo o débito de `count()` sinalizado no QA de E01-S21) e uma **origem** (`manual`,
`cliente_portal`, `whatsapp/ze`, `inspecao`). Pode transicionar para: gerar **OS**, ir para
**backlog** (E01-S83), ou ser **cancelado**.

### D3 — Cancelamento com justificativa + anexo obrigatórios
Cancelar um Chamado exige **justificativa (texto)** e permite/for exige **anexo** (ex.: print do
WhatsApp autorizando). Estado append-only de mudanças (auditável), coerente com `os_status_eventos`.

### D4 — Tela de criação + Portal do Cliente (futuro)
Tela interna para a Sinérgica **criar** Chamado. A entidade é desenhada para depois ser **exposta no
Portal do Cliente** (E09/Área do Cliente) — cliente abre solicitação que vira Chamado. Nesta story:
criação interna + modelo pronto para o portal; a tela do portal em si é fora de escopo.

### D5 — Rename Ticket → Chamado na UI
Toda a UI passa a falar "Chamado"; "Ticket" some da navegação operacional. Glossário atualizado
(linguagem ubíqua — `docs/glossary.md`).

## Alternativas descartadas
- **Status/campo em `pcm.ordens_servico`** (sem tabela nova) — perde o rastreio de itens pré-OS que
  nunca viram OS (cancelados, backlog puro). Descartado.
- **Evoluir `pcm.tickets` in-place** — mantém acoplamento ao sync Auvo que o PO quer cortar.
  Descartado (mas reusa o schema como semente).

## Impacto
- Migration nova `pcm.chamados` (RLS FORCE, sequence de numeração) + tabela de eventos/append-only.
- Glossário + navegação (E01-S80).
- Ponto de integração: inspeção (E01-S90) e Zé/WhatsApp (E01-S89) geram Chamado.

## Riscos
- Numeração concorrente → usar sequence, não `count()`.
- Confusão Ticket×Chamado durante transição → rename claro + Ticket fora da navegação.
