---
name: E01-S151-backlog-pre-triagem
description: Item de backlog nasce sem Chamado — Fabrício triagem confirma antes de virar solicitação/OS
alwaysApply: true
---

# E01-S151 — Backlog nasce sem Chamado (triagem antes de virar solicitação)

## Contexto
Lucas (2026-08-16), olhando o Backlog GUT: item de backlog mostrava um `CH-XXXX` real desde a
criação, mesmo sem ninguém ter decidido que aquilo vira um chamado de verdade — "pode ser que não
tenha uma tratativa". Fluxo confirmado com Fabrício:

1. **Cadastrar item no backlog** (manual, ou vindo de uma inspeção/vistoria) — sem número de
   chamado ainda.
2. **Fabrício trata** e decide: vira chamado ("Confirmar chamado") → passa a existir como
   **solicitação** (`pcm.chamados`, status `aberto`) — OU descarta (`status: cancelado`, sem nunca
   ter virado chamado).
3. Só então entra no **pipeline de atendimento** — decide técnico e quando será tratado.
4. Ao definir técnico + data, vira **OS** de verdade (fluxo "Planejar", já existente).

Isso não contradiz ADR-0014 (Chamado = único identificador ponta a ponta) — só adiciona uma etapa
**antes** do Chamado existir. Hoje, `criarOrdemServico` (`supabase-ordem-servico-adapter.ts`)
sempre cria um Chamado automático na hora, mesmo pra item de backlog puro — é isso que estamos
adiando.

**Achado extra confirmado com Lucas**: `listarBacklogGut` hoje mostra toda OS aberta (solicitação,
backlog, planejamento, em execução — 367 no KPI), não só item pré-triagem. Vai passar a filtrar só
item de backlog de verdade (sem técnico, sem data) — o resto já aparece no Kanban/Operação.

## Requisitos

### AC-1: Item de backlog nasce sem Chamado
- `abrirOrdemServico`/`derivarItemParaOsOuBacklog`, quando o destino é backlog puro (sem técnico,
  sem data), não cria mais um Chamado automático.
- A OS nasce com `chamado_id = null` e um número placeholder (`PRE-XXXXXXXX`, não confundível com
  `CH-XXXX`) — nunca `not null` quebrado, nunca um Chamado fantasma criado.

### AC-2: Backlog GUT mostra só item pré-triagem/backlog de verdade
- `listarBacklogGut` filtra por `ehItemBacklog` (sem técnico, sem data, sem `auvoTaskId`) — igual
  já fazia `hub-os.ts` pra outros usos, só não estava aplicado aqui.
- Item com `PRE-XXXXXXXX` mostra visual distinto (não parece um Chamado real).

### AC-3: Ação "Confirmar chamado"
- Botão novo, visível só em item `PRE-XXXXXXXX`, permissão `pcm:escrita`.
- Cria o Chamado (`CH-XXXX`, status `aberto`), vincula `chamado_id` na OS, atualiza `numero` pro
  `CH-XXXX` real.
- Depois disso, o item segue no Backlog GUT (ainda sem técnico/data) — agora com Chamado de
  verdade, pronto pro botão "Planejar" (já existente) assumir o resto do pipeline.

### AC-4: Ação "Descartar"
- Botão novo, visível em qualquer item do Backlog GUT, permissão `pcm:escrita`.
- Marca a OS como `cancelado` — nunca chega a criar Chamado. Fica no histórico (auditoria/rastreio
  de origem, ex.: qual inspeção gerou), só sai da fila ativa.

### AC-5: "Planejar" exige Chamado confirmado
- Botão "Planejar" (técnico + data) só aparece pra item que já tem Chamado (`numero` não é
  `PRE-XXXXXXXX`) — força a ordem: confirmar chamado antes de agendar.

## Fora de escopo
- Mexer no fluxo de itens que JÁ nascem com técnico/data definidos na hora (ex.: modal "Gerar OS"
  do Assessment, `destino: "os"`) — esses continuam criando Chamado imediato, como hoje (já têm
  técnico, já é trabalho real, não é mais "triagem").
- Nova tabela — reusa `pcm.ordens_servico`/`pcm.chamados` como já são.
- Kanban/Operação (`OrdensServicoPage.tsx`) — continua mostrando tudo que já mostra hoje
  (`pcm.operacao_itens` já inclui toda OS, `PRE-XXXXXXXX` ou não); só o Backlog GUT muda de escopo.

## Tier
Pequeno (1 migration pequena — extensão de trigger existente, sem nova coluna/tabela — + mudanças
de aplicação/UI contidas em poucos arquivos). Não precisa de novo ADR: estende ADR-0014, não
reverte.

---

## Validação
- `ci:local` verde.
- Smoke: criar item de backlog manual → aparece com `PRE-XXXXXXXX`, sem Chamado em `pcm.chamados`.
  "Confirmar chamado" → vira `CH-XXXX` real, chamado criado com status `aberto` depois
  `convertido_os`. "Descartar" → status `cancelado`, some da fila, sem chamado criado.
- Playwright: fluxo completo (criar → confirmar chamado → planejar) e (criar → descartar).
