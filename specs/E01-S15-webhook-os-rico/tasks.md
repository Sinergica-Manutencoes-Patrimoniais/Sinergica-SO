---
name: tasks-E01-S15-webhook-os-rico
description: Decomposição e gates da captura rica do webhook de OS Auvo.
alwaysApply: false
---

# Tasks — E01-S15 Webhook de OS Rico

> Donos Triviaiox: `@pm`/`@analyst` escopo, `@sm` tasks, `@data-engineer` migration, `@dev`
> implementação, `@qa` revisão adversarial. `@devops` fica exclusivo para push/PR no fim.

## Plano
| # | Task | Cobre AC | Gate | Status |
|---|------|----------|------|--------|
| 1 | Migration `0016_E01-S15_auvo_task_snapshots.sql`: criar `pcm.auvo_task_snapshots` com FK para `pcm.ordens_servico`, `auvo_task_id unique`, `payload_raw jsonb`, `relato_usuario text`, `anexos jsonb`, `checklist jsonb`, `pecas_consumidas jsonb`, `controle_horas jsonb`, timestamps de timeline e RLS read-only para `authenticated` no módulo PCM; `service_role` escreve | AC-2..AC-6 | `pnpm run lint:migrations` | done |
| 2 | Extrator defensivo no `pcm-auvo-webhook` para normalizar os campos ricos a partir de nomes plausíveis, preservando sempre o `payload_raw` | AC-2, AC-3, AC-6 | revisão de código + Deno/CI quando disponível | done (código; Deno não executado) |
| 3 | Upsert idempotente do snapshot após resolver a OS e antes/depois da transição de status, sem inserir nada se a assinatura falhar | AC-1, AC-2, AC-5 | revisão de código + Deno/CI quando disponível | done (código; Deno não executado) |
| 4 | Garantir que anexos/fotos são apenas JSON/URL/referência do Auvo, sem Storage local | AC-4 | grep por Storage/bucket/download + revisão adversarial | done |
| 5 | Atualizar ROADMAP/STATE com resultado e limitações de verificação | — | inspeção | done |

## Plano de teste
- `pnpm run lint:migrations`
- `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run build`
- Teste real pendente de Deno/CI: webhook assinado com payload rico e payload mínimo.

## Resultado
- `0016_E01-S15_auvo_task_snapshots.sql` criada e validada por `lint:migrations` + Squawk.
- `pcm-auvo-webhook` agora faz upsert em `pcm.auvo_task_snapshots` depois de validar assinatura e
  resolver a OS. Payload mínimo não quebra; payload rico é preservado em `payload_raw` e normalizado
  defensivamente quando campos conhecidos aparecem.
- Sem Storage: grep confirmou ausência de API de bucket/download no código; anexos ficam como JSON
  vindo do Auvo.

## Gates rodados
- `pnpm run lint:migrations` ✅
- `pnpm run lint` ✅
- `pnpm run typecheck` ✅
- `pnpm test` ✅ (93 passed, 9 skipped)
- `pnpm run build` ✅ (warning existente de chunk >500k)
- `pnpm run audit:esteira` ✅
- `pnpm run eval:spec` ✅, mas continua sem avaliar pastas `E01-*`; validação AC↔task conferida à
  mão nesta story.

## Não verificado neste ambiente
- Edge Function Deno (`pcm-auvo-webhook`) não foi type-checked/executada localmente.
- Payload real do Auvo com anexos/checklist/horas/timeline ainda precisa ser validado em sandbox ou
  produção controlada.

## Divergências
- Nenhuma planejada. A ausência de Storage é decisão explícita de escopo do usuário.

## Revisão adversarial esperada
- Payload sem `taskId` não deve salvar snapshot órfão.
- Payload com anexos sem URL não deve tentar baixar binário.
- Reentrega não deve duplicar linha.
- Assinatura inválida não pode tocar banco.
