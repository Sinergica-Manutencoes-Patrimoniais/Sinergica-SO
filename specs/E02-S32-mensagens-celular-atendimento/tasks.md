---
name: E02-S32-mensagens-celular-atendimento-tasks
description: Tasks executáveis para E02-S32, com correção de SPEC_DEVIATION (tabela errada no spec original)
alwaysApply: false
---

# Tasks — E02-S32 — Mensagens do celular no Atendimento

Owner: Claude (sessão Lucas) · Início: 2026-08-15

## SPEC_DEVIATION
`spec.md` (tasks 1, 3, 4 originais) referencia `atendimento.chamados_interacoes` e
`supabase-historico-chamado-adapter.ts`. Nenhum dos dois existe — `chamados_interacoes`
(migration `0143_E09-S03-S08_portal_operacao.sql`) é do domínio de chamados do **portal do
cliente**, sem relação com o chat do Atendimento. A tabela real do Inbox é
**`atendimento.mensagens`** (migration `0039_E02-S01_atendimento_conversas_mensagens.sql`),
escrita direto pelas Edge Functions (sem adapter de frontend para o fluxo de entrada/IA).
Corrigindo o spec.md nesta mesma tarefa (erro de nome, não decisão de escopo) e prosseguindo com
os nomes reais abaixo.

## Confirmações contra o codebase
- Webhook Evolution real: `supabase/functions/pcm-whatsapp-webhook/index.ts` (não
  `atendimento-evolution/index.ts`, que só administra instância/QR).
- `extractEvolutionMessage` (`_shared/evolution-webhook.ts:39`) já extrai `fromMe`.
- `pcm-whatsapp-webhook/index.ts` hoje **descarta** eventos `fromMe===true` (linha ~53-55:
  `if (message.fromMe) return json(200, {ok:true, ignored:true, reason:"fromMe"})`) — é exatamente
  aqui que a mensagem do celular pessoal é perdida hoje.
- `atendimento.mensagens` (migration `0039`): `direcao text check in ('entrada','saida')`,
  `remetente_tipo text check in ('cliente','ze','humano','agente')` (ampliado em `0043`),
  `wa_message_id text unique` (chave de idempotência), `status_entrega`.
- Inserção de entrada usa RPC `fn_registrar_mensagem_entrada` (dedup por `wa_message_id`, incrementa
  `nao_lidas`). Envio por formulário: `atendimento-whatsapp-envio/index.ts:128-146` (sem
  `wa_message_id`). Envio por IA: `pcm-ze-agent/index.ts:708-722` (`registrarMensagemAgente`, sem
  `wa_message_id`).
- `nao_lidas` só incrementa em inserções `direcao='entrada'` — mensagem de celular é `direcao='saida'`,
  não precisa exclusão explícita no contador (AC-2 já atendido se o insert usar `saida`).

## Tarefas

1. **Migration `0207_E02-S32_origem_envio_mensagens.sql`**: `atendimento.mensagens` ganha coluna
   `origem_envio text check (origem_envio in ('formulario','ia','celular'))`, nullable (mensagens de
   entrada não têm origem de envio). Backfill: `saida` + `remetente_tipo in ('ze','agente')` →
   `'ia'`; `saida` + `remetente_tipo='humano'` → `'formulario'` (assunção correta pro histórico —
   celular não existia antes desta story).
2. **Webhook** `pcm-whatsapp-webhook/index.ts`: antes do early-return de `fromMe`, checar se a
   mensagem já existe via `wa_message_id` (idempotência, mesmo padrão do fluxo de entrada) — se não
   existe, inserir em `atendimento.mensagens` com `direcao:'saida', remetente_tipo:'humano',
   origem_envio:'celular', wa_message_id: <id do evento>, status_entrega:'enviado'`. Resolver
   `conversa_id`/telefone pela mesma lógica usada no fluxo de entrada (mesmo JID). Timestamp do
   evento Evolution usado como `created_at` (AC-3), não `now()`.
3. **RPC**: nova `atendimento.fn_registrar_mensagem_celular` (paralela a
   `fn_registrar_mensagem_entrada`) ou extensão da RPC de saída existente — decidir na implementação
   pelo que já existe pronto pra reuso de resolução de conversa.
4. **UI** `MensagemBubble.tsx`: ícone 📱 + label "Enviado pelo celular" quando `remetente_tipo ===
   'humano' && origem_envio === 'celular'` (ao lado do branch existente do ícone `User`/"Você").
5. **Tipo** `apps/web/src/features/atendimento/domain/mensagens.ts`: `MensagemItem` ganha
   `origemEnvio: 'formulario' | 'ia' | 'celular' | null`.
6. **Testes**: unit (parser do payload Evolution simulando `fromMe:true`) · Playwright (bolha com
   marca 📱 visível na conversa).

## Status
1-3 (migration + webhook + RPC) implementados. Também resolvido: dedup real do eco `fromMe` de
mensagens enviadas pelo PRÓPRIO app (não só celular) — `_shared/evolution.ts` agora devolve o
`key.id` do Evolution e `atendimento-whatsapp-envio/index.ts` grava esse id como `wa_message_id`
na mensagem já inserida, então o eco bate com `on conflict (wa_message_id) do nothing` em vez de
duplicar como "celular" (gap que não estava no spec original, mas era necessário pro AC-4
funcionar de verdade — sem isso, TODO envio pelo formulário/app criaria uma bolha fantasma extra).
4-5 (UI) pendentes.

## Fora de escopo (reafirmado do spec.md)
Envio direto do app · confirmação de entrega (Zap azul).
