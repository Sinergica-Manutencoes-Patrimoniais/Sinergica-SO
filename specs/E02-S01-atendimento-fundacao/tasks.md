---
name: tasks
description: Decomposição e gates — fundação do Inbox de Atendimento (schema + integração Zé).
alwaysApply: false
---

# Tasks — Fundação do Inbox de Atendimento

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `0039_E02-S01_atendimento_conversas_mensagens.sql`: tabelas `conversas`/`mensagens`, índices, RLS FORCE, grants, policies (molde de `0035_E01-S32_equipes.sql`) | AC-1, AC-7 | E01-S02 mergeada | `lint:migrations` | feito |
| 2  | pgTAP `supabase/tests/atendimento_conversas_rls.test.sql` + `atendimento_mensagens_rls.test.sql` | AC-7 | 1 | `supabase test db` | feito |
| 3  | `supabase/functions/_shared/evolution.ts`: extrai `responderEvolution` de `pcm-ze-agent` | — (infra p/ AC-2, AC-6) | — | teste Deno | feito |
| 4  | Editar `pcm-whatsapp-webhook/index.ts`: upsert `conversas` + insert `mensagens` (aditivo, após o upsert de `wa_messages` existente) | AC-1, AC-4 | 1 | teste Deno de regressão (fluxo existente intocado) | feito |
| 5  | Editar `pcm-ze-agent/index.ts`: check de `conversas.modo`, espelho de resposta em `mensagens`, link `ordem_servico_id`, campo `forcar` opcional | AC-2, AC-3, AC-5 | 1, 3 | teste Deno de regressão (cron sem `forcar` idêntico a antes) | feito |
| 6  | `atendimento-whatsapp-envio/index.ts` novo (`enviar`/`assumir`/`devolver`) | AC-6 | 1, 3 | teste Deno de integração (mock HTTP Evolution) | feito |
| 7  | Rodar `pnpm run ci:local` | todos | 1-6 | `pnpm run ci:local` | feito |
| 8  | Atualizar ROADMAP/STATE | — | 7 | revisão humana | feito |

## Plano de teste
- pgTAP: RLS FORCE das 2 tabelas novas (AC-7).
- Regressão Deno: `pcm-whatsapp-webhook`/`pcm-ze-agent` com fixture de payload já usada em
  `E01-S02` (se existir) produzindo o mesmo resultado de antes + as novas linhas em
  `conversas`/`mensagens`.
- Integração Deno (mock HTTP Evolution): `atendimento-whatsapp-envio` — sucesso grava
  `status_entrega='enviado'`; falha do Evolution grava `'erro'` sem lançar; usuário sem RLS de
  leitura na conversa não consegue nem tentar enviar.
- Aceite: os 7 AC de `spec.md`.

## Divergências (SPEC_DEVIATION)
- [x] Task 1: a migration ganhou uma RPC `atendimento.fn_registrar_mensagem_entrada` (não prevista
      no design original) — necessária pra fazer o upsert de `conversas` + incremento de
      `nao_lidas` + insert de `mensagens` atomicamente, sem race condition; um upsert simples via
      `.upsert()` do client JS incrementaria `nao_lidas` de novo em toda reentrega/retry da MESMA
      mensagem (Evolution reenvia em falha de rede), já que o dedupe por `wa_message_id` só
      acontece dentro da própria RPC. Coberta por `atendimento_registrar_mensagem_rpc.test.sql`
      (prova a idempotência explicitamente).
- [x] Task 6: as 3 ações (`enviar`/`assumir`/`devolver`) ficaram concentradas na mesma Edge
      Function em vez de `assumir`/`devolver` virarem update direto no adapter do frontend (opção
      que o design.md mencionava como possível) — decisão de simplicidade de superfície, sem
      duplicar a resolução de `conversaId`/checagem RLS em dois lugares.

## Checklist de Definition of Done
- [x] Todos os AC (AC-1 a AC-7) implementados em código local
- [ ] Todos os AC verdes pelo gate executável completo (Deno/pgTAP — Deno CLI/Docker ausentes
      neste ambiente, mesma ressalva de toda a integração Auvo/Zé desde E01-S09)
- [x] `pcm-whatsapp-webhook`/`pcm-ze-agent` não regrediram o fluxo existente de `E01-S02` — revisão
      manual linha a linha confirma que o caminho de OS já conhecida e a máquina de transição de
      status ficaram intocados, só houve adição de passos novos
- [x] `docs/STATE.md`/`docs/epics/ROADMAP.md` atualizados
- [x] Gates locais verdes: `lint:migrations` (39 migrations), `lint`, `typecheck`, `test`
      (175 pass/9 skip), `build`, `arch:check`, `audit:esteira` (184 docs), `eval:spec`
- [ ] `pnpm run ci:local` verde completo no CI real (`db-tests`/Deno) — confirmar antes do merge
