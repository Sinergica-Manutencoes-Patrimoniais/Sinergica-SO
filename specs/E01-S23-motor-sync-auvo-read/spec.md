---
name: spec
description: Contrato — motor de sync Auvo→PCM (dispatcher de webhook genérico + poller + auto-registro).
alwaysApply: true
---

# Spec — Motor de sync Auvo (read path)

> **Fonte da verdade.** Status: aprovado
> Ver `product.md` (por quê) e o adendo "Read path" em
> [`../E01-S22-motor-sync-auvo-write/design.md`](../E01-S22-motor-sync-auvo-write/design.md) (como).

## Resumo
O webhook Auvo (`pcm-auvo-webhook`) passa a despachar por entidade via o registry (além do handler
de Task já existente, inalterado), e uma nova Edge Function `pcm-auvo-pull` provê polling genérico
por descriptor — juntos, fecham o sentido Auvo→PCM do motor de sync para qualquer entidade futura.

## Critérios de aceite

### AC-1: Webhook de entidade com descriptor faz upsert por `auvo_id`
- **Dado** um evento de webhook Auvo válido (assinatura HMAC ok) com `entity` correspondendo a um
  descriptor `webhookEntity` registrado e `writeEnabled=true`
- **Quando** `action` é Inclusão (1) ou Alteração (2)
- **Então** a linha correspondente em `pcm.<pcmTable>` é criada/atualizada via
  `fn_apply_auvo_sync` com o patch de `descriptor.fromAuvo(payload)`, upsert por `auvo_id`

### AC-2: Webhook de exclusão vira soft-delete, nunca DELETE físico
- **Dado** o mesmo cenário do AC-1
- **Quando** `action` é Exclusão (3)
- **Então** a linha correspondente recebe `deleted_at = now()` (e `ativo = false` quando a coluna
  existir) via `fn_apply_auvo_sync` — nunca um `DELETE` físico

### AC-3: Entidade sem descriptor ou com `writeEnabled=false` é ignorada com 200
- **Dado** um evento de webhook cujo `entity` não tem descriptor registrado, ou tem descriptor com
  `writeEnabled=false`
- **Quando** o webhook é processado
- **Então** a função responde `200 { ok:true, ignored:true }` sem tocar em nenhuma tabela —
  reentrega do Auvo não deve virar erro permanente (mesmo princípio já aplicado ao handler de Task)

### AC-4: Handler de Task existente permanece inalterado
- **Dado** um evento de webhook com `entity=Task` (4)
- **Quando** processado
- **Então** o comportamento é EXATAMENTE o mesmo de `E01-S10`/`E01-S15`/`E01-S16` (status de OS,
  snapshot rico, vínculo de equipamento) — o dispatcher novo não interfere nesse caminho

### AC-5: Poller genérico pagina, mapeia e reconcilia por entidade
- **Dado** um descriptor com `cronSchedule` definido e `writeEnabled=true`
- **Quando** `pcm-auvo-pull` é invocada com `{ entity: "<key>" }`
- **Então** pagina TODAS as páginas do endpoint `descriptor.auvoBasePath` (propaga erro de
  qualquer página, sem escrita parcial), mapeia cada registro via `descriptor.fromAuvo`, upsert por
  `auvo_id` na tabela do descriptor, e soft-deleta (`deleted_at`) os registros que sumiram —
  mesmo padrão de `pcm-auvo-customers-import`

### AC-6: Guarda de resultado vazio no poller
- **Dado** o poller completou a paginação com sucesso mas devolveu ZERO registros
- **Quando** a reconciliação de soft-delete rodaria
- **Então** ela é PULADA (log de aviso), para não desativar em massa por uma resposta suspeita —
  mesma guarda já usada em `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync`/`pcm-auvo-customers-import`

### AC-7: Auto-registro de webhook é idempotente
- **Dado** a Edge Function one-shot `pcm-auvo-webhooks-register`
- **Quando** invocada (manualmente, pós-deploy) uma ou mais vezes
- **Então** cada descriptor com `webhookEntity` definido tem seu webhook registrado no Auvo
  (`POST /webhooks`); reinvocar não duplica registros no Auvo (usa o `id` retornado anteriormente
  quando disponível, ou confia na resposta 400 "already registered" do Auvo como sinal de já-feito)

## Casos de borda e erros
- Payload de webhook para uma das 4 novas entidades vem em shape inesperado (campo ausente): o
  `fromAuvo` do descriptor deve ser defensivo (mesmo estilo de `extractTaskId`/`deepFind` já usado
  no handler de Task) — nunca lançar por campo ausente, mapear o que der e deixar o resto `null`.
- Duas invocações concorrentes do poller para a MESMA entidade (cron sobreposto): aceitável
  correrem em paralelo — upsert por `auvo_id` é idempotente, não há necessidade do lock do outbox
  aqui (não há "outbox" no sentido inverso, é leitura direta do Auvo).
- Webhook chega para uma entidade cujo `pcmTable` ainda não tem a linha (nunca sincronizada
  PCM→Auvo nem importada): `fn_apply_auvo_sync` faz `UPDATE ... WHERE id = $1`, que não cria linha
  nova — se a linha não existe, o patch é um no-op silencioso. **Decisão**: para as entidades novas
  que também têm import inicial (mesmo padrão de `pcm-auvo-customers-import`), o import roda antes
  do webhook estar registrado, então esse caso deve ser raro; se ocorrer, fica sem efeito e visível
  só via ausência de atualização (sem alerta nesta fase — mesma dívida aceita nas demais stories).

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Qualquer descriptor concreto de entidade — `E01-S24`+.
- Invoice (Financeiro) — descartado pelo usuário na épica.
- Tabela de controle dos webhooks registrados (ids retornados) — reexecutar
  `pcm-auvo-webhooks-register` é idempotente o bastante sem isso nesta fase.
- Alterar o comportamento do handler de Task existente (AC-4 garante que ele não muda).

## Rastreabilidade
- Product: `./product.md` · Design: `../E01-S22-motor-sync-auvo-write/design.md` (adendo "Read
  path") · Domínio: `../E01-S22-motor-sync-auvo-write/domain.md`
- ADRs relacionados: `docs/adr/0001-pcm-origin-truth-externalid.md`,
  `docs/adr/0005-outbox-sync-auvo.md`
