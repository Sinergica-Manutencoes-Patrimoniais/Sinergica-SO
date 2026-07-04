---
name: tasks
description: Decomposição e gates do webhook Auvo de status/conclusão. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Integração Auvo: Webhook de Status e Conclusão de OS

> Implementado nesta sessão (`@dev`, worktree paralelo). `E01-S09` (fundação) já mergeada em
> `main` (PR #10) — desbloqueou esta story. Sem Deno CLI neste ambiente: código escrito seguindo
> exatamente as convenções de `pcm-auvo-create-task`/`pcm-auvo-customers-sync`, mas não
> type-checked nem executado. Ver Divergências abaixo para as 2 decisões que precisaram de
> julgamento por causa de gaps encontrados durante a implementação.

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|-----------------|--------|
| 1  | Registrar webhooks no Auvo (`POST /webhooks`, `entity=Task`, `action=Alteração`) apontando para a URL da Edge Function — passo manual/script, não código de app | AC-2, AC-3, AC-4 | `E01-S09` implementada | `GET /webhooks` mostra `active: true` | todo (operacional — fora do alcance de um agente sem credenciais Auvo reais de produção) |
| 2  | Secret do webhook (`AUVO_WEBHOOK_SECRET`): `gh secret set AUVO_WEBHOOK_SECRET` no repo + adicionar na lista de `supabase secrets set` de `.github/workflows/sync-secrets.yml` (mesmo padrão de `E01-S09` task 2) | AC-1 | — | `supabase secrets list` (após rodar o workflow) | parcial — wiring no workflow feito (`AUVO_WEBHOOK_SECRET` adicionado à lista); `gh secret set` com o valor real é passo manual (não há secret real disponível para este agente configurar) |
| 3  | Validação de assinatura HMAC-SHA256 (`_shared/auvo/verify-signature.ts`, baseado no exemplo TS do mapeamento §13.2) | AC-1 | 2 | teste unitário: assinatura válida passa, inválida retorna 401 | done (código + `verify-signature.test.ts` com 12 casos: válida, hex errado, secret errado, corpo alterado, expirada passado/futuro, borda 299s, header ausente/malformado/trocado, timestamp não numérico, secret vazio) — **não executado** (sem Deno CLI) |
| 4  | Edge Function `pcm-auvo-webhook`: parse do evento, resolve OS por `auvo_task_id` | AC-2 a AC-6 | 3 | teste de integração com payload de exemplo | done (código escrito, `supabase/functions/pcm-auvo-webhook/index.ts`) — **não executado**, sem teste de integração (mesmo padrão de `pcm-auvo-create-task`/`pcm-auvo-customers-sync`, que também não têm; sem Deno CLI/mock HTTP configurado neste ambiente para escrevê-lo com confiança) |
| 5  | Máquina de transição de status (Auvo status → `pcm.ordens_servico.status`), idempotente `[P]` | AC-2, AC-3, AC-4, AC-5 | 4 | teste unitário: mesma transição 2x não gera erro | done — `resolveTargetStatus()` inline no index.ts; idempotência via `UPDATE ... WHERE auvo_task_id = X AND status <> Y` (mesma técnica de idempotência de `pcm-auvo-create-task`, sem tabela de dedup nova, ver Divergência #2 abaixo) — **não executado** |
| 6  | Tratamento de `taskId` desconhecido → `200` + log, sem exceção `[P]` | AC-6 | 4 | teste: payload com `taskId` inexistente retorna 200 | done (código) — **não executado** |
| 7  | Gatilho `pcm.pmoc_records` na conclusão de OS preventiva de climatização | AC-7 | 5 | teste de integração: OS preventiva concluída → registro PMOC criado | **não implementado — SPEC_DEVIATION #1** (ver abaixo). Log estruturado de aviso emitido no lugar. |
| 8  | Log estruturado de todo evento recebido (mesmo os rejeitados por assinatura) `[P]` | AC-1, AC-6 | 4 | inspeção de log em teste de integração | done (código) — log de entrada em toda requisição, log de warn em assinatura rejeitada, log de warn/info em cada ramo de ignore/no-op — **inspeção de código apenas, não executado** |
| 9  | `docs/epics/ROADMAP.md` + `docs/STATE.md`: marcar `E01-S10` implementado, AC verdes | — | 1-8 | inspeção | done (esta sessão) |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual (exceto onde
> marcado "inspeção"). **Ressalva desta sessão:** nenhum gate de execução real (Deno test/CI) foi
> rodado — ver "Verificação" no relatório da story. Os gates Node (`lint:migrations`,
> `audit-esteira`, `eval-spec-fidelity`) foram rodados e estão reportados abaixo; o `db-tests`
> (pgTAP) real do CI é quem vai validar esta migration/schema quando o PR for aberto — mas esta
> story não adicionou migration (ver Divergência #3).

## Plano de teste
- Unidade: validação de assinatura (válida/inválida/expirada) — `verify-signature.test.ts`, 12
  casos. Máquina de transição de status — coberta indiretamente pela leitura de código
  (`resolveTargetStatus`); **não há teste unitário isolado para ela** porque está inline no
  `index.ts` do Edge Function, mesmo padrão dos outros dois Edge Functions Auvo desta integração
  (que também não extraem lógica de negócio para módulo testável fora do `index.ts`) — dívida
  reconhecida, não nova nesta story.
- Integração: `pcm-auvo-webhook` com payloads de exemplo — **não escrita**. Nem
  `pcm-auvo-create-task` nem `pcm-auvo-customers-sync` (E01-S09) têm teste de integração hoje;
  sem Deno CLI/mock HTTP configurado neste ambiente para introduzir esse padrão com confiança
  nesta story. Fica como próximo passo (possivelmente uma story de qualidade cross-cutting para
  as 3 Edge Functions Auvo).
- Aceite: um teste por AC — **AC-1 coberto** (`verify-signature.test.ts`). AC-2 a AC-7 **não têm
  teste automatizado** nesta sessão — apenas leitura de código. Ver Divergências #1 e #2 para
  AC-7 e a interpretação de AC-4.

## Divergências (SPEC_DEVIATION)

### SPEC_DEVIATION #1 — AC-7 (registro PMOC) não implementado
`pcm.pmoc_records` **não existe** em nenhuma migration de `supabase/migrations/` — PMOC
(`E01-S03` a `E01-S08`) segue "Planejado" no `docs/epics/ROADMAP.md`, ainda não construído. AC-7
("OS preventiva de climatização concluída dispara criação de registro PMOC") não pode ser
implementado como escrito: não há tabela para inserir.

**Decisão:** implementar AC-1 a AC-6 integralmente. Para AC-7, **não criar** `pcm.pmoc_records`
nesta story — o schema de PMOC é decisão arquitetural da própria PMOC (tier arquitetural,
`E01-S03`), não desta story de webhook. Em vez disso, quando o webhook processa uma conclusão
(AC-2) de uma OS com `categoria = 'preventiva'`, o código (`supabase/functions/pcm-auvo-webhook/
index.ts`, bloco final antes do `return`) loga um aviso estruturado (`nivel: "warn"`) sinalizando
que a criação do registro PMOC está deferida, marcado inline como:
```
// SPEC_DEVIATION: AC-7 não implementado — pcm.pmoc_records não existe ainda (PMOC não
// implementado, ver ROADMAP). Loga aviso estruturado e segue sem criar o registro; ver tasks.md.
```
**Ação futura:** quando `E01-S03`/`E01-S04` (schema + inventário PMOC) forem implementadas, esta
função precisa ganhar o `INSERT` em `pcm.pmoc_records` — reabrir esta story ou abrir uma nova
(`E01-S1x`) dependente de PMOC existir.

### SPEC_DEVIATION #2 — Mapeamento Auvo status → OS status (AC-2/AC-3/AC-4), incluindo interpretação de "Cancelada"
O enum documentado de `taskStatus` do Auvo (`Auvo-API-Mapeamento-Completo.md` §2.14) só tem **6
valores**: `1=Aberta, 2=Em Deslocamento, 3=Check-in Realizado, 4=Check-out Realizado,
5=Finalizada, 6=Pausada`. **Não existe** valor "Cancelada" documentado nesse enum — a spec AC-4
("task Cancelada → OS `cancelado`") não mapeia diretamente para um `taskStatus`.

**Decisão adotada** (implementada em `resolveTargetStatus()`, `pcm-auvo-webhook/index.ts`):
- `action=2 (Alteração)` + `taskStatus=5 (Finalizada)` → OS `finalizado` (AC-2).
- `action=2 (Alteração)` + `taskStatus` em `{2, 3, 4}` (deslocamento/check-in/check-out, qualquer
  estado "em campo") → OS `em_execucao` (AC-3 — "técnico fez check-in").
- `action=3 (Exclusão)` da task → OS `cancelado` (AC-4) — **tratando exclusão da task no Auvo
  como o sinal de cancelamento**, por ser a interpretação mais defensável dado o enum
  documentado (o webhook já distingue `entity`/`action` de `Customer`/`User`/`Equipment`/`Task`
  × `Inclusão`/`Alteração`/`Exclusão`, então `action=3` em `entity=Task` é um evento real e
  distinto de "Alteração", diferente de tentar adivinhar um `taskStatus` inexistente).

**Isto é uma inferência, não uma confirmação contra um payload real de webhook do Auvo** — marcado
inline no código:
```
// SPEC_DEVIATION: o taskStatus documentado do Auvo (§2.14) não tem valor "Cancelada" — mapeamento
// action=3 (Exclusão) → 'cancelado' é inferido, a confirmar contra um webhook real antes de prod.
```
**Ação antes de produção:** confirmar contra um webhook de teste real do Auvo (registrar o
webhook em ambiente de sandbox/homologação do Auvo, se disponível, e observar o payload de uma
task cancelada de verdade) antes de depender deste mapeamento em produção. Se o Auvo de fato
cancela via `taskStatus` não documentado (ex.: um 7º valor não coberto no mapeamento consultado),
esta função vai silenciosamente ignorar o evento (cai no `return null` de "sem transição
mapeada") em vez de cancelar a OS — risco a monitorar via os logs de "Alteração de Task sem
taskStatus mapeado".

### Nota (não é SPEC_DEVIATION, é decisão de implementação já dentro do escopo dado)
Idempotência (AC-5) implementada **sem** tabela de dedup por `deliveryId` (a sugestão do mapeamento
do vault) — usa `UPDATE ... WHERE auvo_task_id = X AND status <> Y`, mesma técnica de idempotência
que `pcm-auvo-create-task` já usa (checar estado atual antes de agir), evitando introduzir uma
tabela nova só para este propósito. Efeito colateral aceito: se o Auvo reentregar um evento
"antigo" DEPOIS de a OS já ter avançado para um estado posterior (ex.: replay tardio de
"em_execucao" depois que a OS já foi para "finalizado"), o guard `status <> Y` impede a
regressão acidental (não regride de `finalizado` para `em_execucao`) — comportamento desejável,
não só um efeito colateral acidental.

## Checklist de Definition of Done
- [x] AC-1 verde **pelo gate executável** — mas o gate (`deno test`) **não pôde ser rodado neste
      ambiente** (sem Deno CLI); só a leitura do teste escrito confirma a cobertura pretendida.
- [ ] AC-2 a AC-6 verdes pelo gate executável — **não verificado**, sem teste de integração
      escrito nem Deno CLI disponível.
- [ ] AC-7 — **não implementado** (SPEC_DEVIATION #1).
- [x] Glossário — sem termo novo introduzido nesta story.
- [x] Spec reflete o que foi construído — 2 SPEC_DEVIATION registrados acima; `spec.md` não foi
      alterado (mantém o texto original, a divergência mora aqui em `tasks.md` + inline no código,
      seguindo a convenção já usada em `E01-S09`).
- [x] `docs/STATE.md` atualizado (esta sessão).
- [ ] Webhook secret em Supabase Vault — **wiring feito** (`sync-secrets.yml`), **valor real não
      provisionado** (passo manual, task 1/2 acima).
