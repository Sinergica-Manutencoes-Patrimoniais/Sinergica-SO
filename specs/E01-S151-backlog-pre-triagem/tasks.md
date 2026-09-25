---
name: E01-S151-backlog-pre-triagem-tasks
description: Tasks executáveis para E01-S151
alwaysApply: false
---

# Tasks — E01-S151 — Backlog nasce sem Chamado

Owner: Claude (sessão Lucas) · Início: 2026-08-16

## Confirmações contra o codebase
- `pcm.ordens_servico.numero` é `not null unique` — não dá pra deixar `null` sem tocar em ~43
  call sites de `.numero` espalhados (Kanban/Timeline/Calendário/Dashboard/Backlog). Decisão: em
  vez de tornar nullable, a trigger `fn_ordens_servico_sync_numero_chamado` (migration 0151) passa
  a gerar um placeholder `PRE-XXXXXXXX` (8 primeiros chars do próprio `id`, maiúsculo) quando
  `chamado_id is null` — mantém o tipo `string` em todo lugar, zero ripple.
- `criarOrdemServico` (`supabase-ordem-servico-adapter.ts:127-180`) hoje SEMPRE cria Chamado
  automático quando `input.chamadoId` está ausente (`criarChamadoAutomatico` +
  `marcarChamadoAutomaticoComOs`). Isso é o que estamos tornando condicional.
- `listarBacklogGut` (`hub-os.ts:18-37`) hoje filtra só `ehOsAberta` — não usa `ehItemBacklog`
  (`ordens-servico.ts:224`), que já existe e já checa sem-técnico/sem-data/sem-auvoTask.
- Trigger de sync de número é `before insert` só (migration 0151, linha 80-82) — não dispara em
  UPDATE. `confirmarChamado` precisa setar `numero` explicitamente no UPDATE, não pode confiar na
  trigger.

## Tarefas

1. **Migration `0209_E01-S151_backlog_sem_chamado.sql`**: recria
   `pcm.fn_ordens_servico_sync_numero_chamado()` — branch novo `else new.numero :=
   'PRE-' || upper(substr(new.id::text, 1, 8));` quando `new.chamado_id is null`. Sem alteração de
   coluna/constraint.
2. **`ordem-servico-gateway.ts`**: `CriarOrdemServicoInput` ganha `semChamado?: boolean` (default
   ausente = comportamento atual, cria Chamado). `OrdemServicoGateway` ganha método
   `confirmarChamado(input: {ordemId, clientId, titulo, userId}): Promise<{numero: string}>`.
3. **`supabase-ordem-servico-adapter.ts`**:
   - `criarOrdemServico`: só chama `criarChamadoAutomatico`/`marcarChamadoAutomaticoComOs` quando
     `!input.chamadoId && !input.semChamado`.
   - Novo `confirmarChamado`: chama `criarChamadoAutomatico`, faz `update` na OS
     (`chamado_id` + `numero` explícito — trigger não cobre UPDATE), chama
     `marcarChamadoAutomaticoComOs`.
4. **`abrir-ordem-servico.ts`**: nova função `confirmarChamadoBacklog(gateway, {ordemId, clientId,
   titulo, userId})` — validação mínima (delega o resto pro gateway) + `descartarItemBacklog`
   (reusa `alterarStatusOrdemServico` já existente com `status: 'cancelado'`, ou wrapper fino se
   fizer sentido pela assinatura atual).
5. **`assessment.ts`** (`derivarItemParaOsOuBacklog`): quando `destino === 'backlog'`, passa
   `semChamado: true` no input pro `abrirOrdemServico`. `destino === 'os'` continua sem a flag
   (já nasce com técnico/tipoTarefa, chamado imediato como hoje).
6. **`NovaOrdemServicoModal.tsx`** (fluxo "Novo item de backlog", aberto por `BacklogGutPage`):
   quando técnico fica em branco na criação, passa `semChamado: true`.
7. **`hub-os.ts`** (`listarBacklogGut`): troca filtro `ehOsAberta` por `ehItemBacklog` (importar de
   `ordens-servico.ts`).
8. **`BacklogGutPage.tsx`**:
   - Estilo distinto pra `numero` que começa com `PRE-` (cor neutra + label "Aguardando
     triagem" em vez do badge de status normal).
   - Botão "Confirmar chamado" (só em item `PRE-`, `temEscrita`) → chama
     `confirmarChamadoBacklog` → recarrega.
   - Botão "Descartar" (qualquer item, `temEscrita`) → chama `descartarItemBacklog` → recarrega.
   - Botão "Planejar" só aparece quando `!numero.startsWith("PRE-")`.
9. **Testes**: unit (`ordens-servico.test.ts` pro filtro do backlog se algo for extraído puro;
   `abrir-ordem-servico.test.ts` pra `confirmarChamadoBacklog`/`semChamado`) + Playwright (criar →
   confirmar chamado → planejar; criar → descartar).

## Fora de escopo (reafirmado do spec.md)
`destino: "os"` do Assessment · Kanban/Operação · nova tabela.
