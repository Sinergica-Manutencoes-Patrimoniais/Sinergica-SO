---
name: spec-E01-S05-visitas-laudo-pdf
description: Contrato — OS síncrona a partir do cronograma PMOC, registro de visita (webhook), laudo PDF e alerta de atraso.
alwaysApply: true
tier: arquitetural
---

# Spec — E01-S05: Visitas, registro (`pmoc_records`) e laudo PDF

> Fecha o `SPEC_DEVIATION AC-7` deixado por E01-S10/E01-S16 (`pmoc_records` não existia). Depende
> de E01-S07 (`ordens_servico.pmoc_schedule_id`) e E00-S12 (Integrações, pro envio de e-mail).

## Resumo
Do cronograma PMOC até o laudo: (1) usuário cria a OS de uma visita agendada **de forma síncrona**
(botão na tela, dispara o pipeline Auvo já existente — sem cron, decisão do PO); (2) quando a tarefa
finaliza no Auvo, o webhook já existente cria o registro de visita (`pmoc_records`); (3) uma Edge
Function gera o laudo em PDF, sobe pro Storage e (se a integração de e-mail estiver configurada e
ativa — E00-S12) envia ao contato do imóvel; (4) um cron diário marca visitas vencidas como atrasadas
(alimenta o painel de alertas de E01-S08, sem precisar de nova UI de notificação).

## Critérios de aceite

**AC-1 — Criar OS a partir da visita (síncrona).** Given uma linha do cronograma PMOC (`pmoc_schedules`,
status `agendado`), When o usuário `pcm:escrita` clica "Criar OS", Then uma OS é criada **sincronamente**
via o pipeline existente (`abrirOrdemServico` → `pcm-auvo-create-task`, já síncrono e já em produção),
com `categoria='preventiva'` e `pmoc_schedule_id` apontando pra essa visita — `inferirTipoOsHub`
(E01-S07) classifica automaticamente como `P1`. O botão desaparece/desabilita depois (schedule já
tem OS vinculada, evita duplicar).

**AC-2 — Registro de visita ao finalizar (webhook).** Given uma OS com `pmoc_schedule_id`, When a
tarefa correspondente finaliza no Auvo (webhook `pcm-auvo-webhook`), Then é criado um
`pcm.pmoc_records` (data de execução, tipo de manutenção, técnico, número da OS) e o schedule vira
`status='realizado'` com `record_id` preenchido. Idempotente — reentrega do mesmo evento não duplica
o registro (checa `schedule.record_id` antes de criar).

**AC-3 — Gerar laudo PDF.** Given um `pmoc_records`, When a Edge Function `pmoc-generate-pdf` é
chamada com o `recordId`, Then gera um PDF (cabeçalho do contrato/imóvel, dados da visita, checklist
se houver), sobe pro bucket privado `pmoc-laudos` e grava a URL assinada/relativa em
`pmoc_records.pdf_url`.

**AC-4 — Envio por e-mail (gated).** Given a integração de e-mail (E00-S12) **ativa e com chave
configurada**, When o laudo é gerado, Then é enviado ao `contact_email` do imóvel. **Sem integração
ativa**, o PDF é gerado e salvo normalmente — só o envio é pulado, com log explícito (nunca falha
silenciosamente nem finge sucesso).

**AC-5 — Cron de status atrasado.** Given uma visita `agendada` com `scheduled_date` no passado,
When o cron diário `pmoc-daily-status` roda, Then `status` vira `'atrasado'` — sem criar nada, sem
notificar (o painel de E01-S08 já mostra isso ao vivo via `contratosComAlerta`).

## Casos de borda
- Webhook recebe finalização de uma tarefa cujo `pmoc_schedule_id` já tem `record_id` (reentrega) →
  não cria segundo registro, não lança erro (AC-2, idempotência).
- `pmoc-generate-pdf` chamado pra um `pmoc_records` sem `contract_id`/`property_id` resolvíveis →
  erro claro, não gera PDF corrompido.
- Checklist/NCs da visita: **não vêm no payload de finalização de tarefa hoje** — o `pmoc_records`
  criado pelo webhook (AC-2) tem `checklist`/`equipment_records`/`nonconformities` vazios
  (`null`/`{}`). É um gap conhecido e sinalizado (não é regressão: não existia registro nenhum antes).
  O laudo PDF (AC-3) reflete isso — mostra "sem checklist registrado" em vez de inventar dado.

## Fora de escopo (vinculante)
- Preenchimento manual do checklist/NCs pelo técnico dentro do Auvo → captura estruturada no PCM —
  depende de payload real do Auvo não confirmado; gap sinalizado acima.
- Reenvio manual de e-mail / botão "testar envio" — E00-S12 cobriu só o cadastro da credencial.
- Qualquer alerta por push/WhatsApp — o painel de E01-S08 já cobre a necessidade de visibilidade.

## Rastreabilidade
- Migration: `supabase/migrations/0104_E01-S05_pmoc_laudos_bucket.sql` (bucket Storage `pmoc-laudos`
  + policies). "Já tem OS" (AC-1) é checado via `ordens_servico.pmoc_schedule_id` (E01-S07, já
  existe) — sem coluna nova em `pmoc_schedules`.
- Webhook: `supabase/functions/pcm-auvo-webhook/index.ts` (fecha SPEC_DEVIATION AC-7).
- Edge Function nova: `supabase/functions/pmoc-generate-pdf/index.ts`.
- Cron: `supabase/functions/pmoc-daily-status/index.ts` + migration de `cron.schedule`.
- Application/UI: `apps/web/src/features/pcm/application/pmoc.ts` (`criarOsDaVisitaPmoc`), `pages/PmocPage.tsx` (botão "Criar OS" no cronograma).
