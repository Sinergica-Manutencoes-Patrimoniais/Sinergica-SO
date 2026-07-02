---
name: tasks
description: Decomposição e gates do webhook Auvo de status/conclusão. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Integração Auvo: Webhook de Status e Conclusão de OS

> Nenhuma task executada ainda — resultado de estudo/planejamento. Depende de `E01-S09` (fundação)
> estar implementada primeiro (task creation precisa existir para o webhook ter o que atualizar).

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Registrar webhooks no Auvo (`POST /webhooks`, `entity=Task`, `action=Alteração`) apontando para a URL da Edge Function — passo manual/script, não código de app | AC-2, AC-3, AC-4 | `E01-S09` implementada | `GET /webhooks` mostra `active: true` | todo |
| 2  | Secret do webhook (`AUVO_WEBHOOK_SECRET`) no Supabase Vault | AC-1 | — | `supabase secrets list` | todo |
| 3  | Validação de assinatura HMAC-SHA256 (`_shared/auvo/verify-signature.ts`, baseado no exemplo TS do mapeamento §13.2) | AC-1 | 2 | teste unitário: assinatura válida passa, inválida retorna 401 | todo |
| 4  | Edge Function `pcm-auvo-webhook`: parse do evento, resolve OS por `auvo_task_id` | AC-2 a AC-6 | 3 | teste de integração com payload de exemplo | todo |
| 5  | Máquina de transição de status (Auvo status → `pcm.ordens_servico.status`), idempotente `[P]` | AC-2, AC-3, AC-4, AC-5 | 4 | teste unitário: mesma transição 2x não gera erro | todo |
| 6  | Tratamento de `taskId` desconhecido → `200` + log, sem exceção `[P]` | AC-6 | 4 | teste: payload com `taskId` inexistente retorna 200 | todo |
| 7  | Gatilho `pcm.pmoc_records` na conclusão de OS preventiva de climatização | AC-7 | 5 | teste de integração: OS preventiva concluída → registro PMOC criado | todo |
| 8  | Log estruturado de todo evento recebido (mesmo os rejeitados por assinatura) `[P]` | AC-1, AC-6 | 4 | inspeção de log em teste de integração | todo |
| 9  | `docs/epics/ROADMAP.md` + `docs/STATE.md`: marcar `E01-S10` implementado, AC verdes | — | 1-8 | inspeção | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde
> marcado "inspeção").

## Plano de teste
- Unidade: validação de assinatura (válida/inválida/expirada), máquina de transição de status
  (todas as combinações válidas + idempotência).
- Integração: `pcm-auvo-webhook` com payloads de exemplo dos 3 eventos relevantes (Em execução,
  Concluída, Cancelada), payload malformado, `taskId` desconhecido.
- Aceite: um teste por AC desta spec (AC-1 a AC-7).

## Divergências (SPEC_DEVIATION)
- Nenhuma — story ainda não implementado.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Glossário atualizado se mudou
- [ ] Spec reflete o que foi construído
- [ ] `docs/STATE.md` atualizado
- [ ] Webhook secret em Supabase Vault, nunca em código ou `.env` commitado
