---
name: tasks
description: Decomposição e gates de E02-S40. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S40 · Foto do WhatsApp do contato

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Migration `1838` — `foto_de_contato`, colunas em `conversas`, bucket privado, RLS force | AC-3 | — | `pnpm run db:test -- foto_de_contato` | todo |
| 2  | `fn_reservar_consulta_de_foto` (janela de 7 dias, atômica) | AC-7 | 1 | `pnpm run db:test -- reservar_foto` | todo |
| 3  | `fn_registrar_foto_de_contato` (guardada / sem_foto apaga / hash) | AC-8, AC-9 | 1 | `pnpm run db:test -- registrar_foto` | todo |
| 4  | `_shared/foto-do-contato.ts` — pipeline com conferência por assinatura e teto de 1 MB | AC-4, AC-12 | 2, 3 | `deno test supabase/functions/_shared/foto-do-contato.test.ts` | todo |
| 5  | Disparo em segundo plano no webhook, só entrada e só Evolution | AC-2, AC-14 | 4 | `deno test supabase/functions/atendimento-evolution-webhook/foto.test.ts` | todo |
| 6  | `atendimento-anexo` ganha rota de foto, com 404 indistinguível | AC-10 | 3 | `deno test supabase/functions/atendimento-anexo/foto.test.ts` | todo |
| 7  | Avatar com foto + fallback para iniciais em lista, cabeçalho e perfil | AC-1, AC-5, AC-6, AC-9 | 6 | `pnpm vitest run apps/web/src/features/atendimento/components/Avatar.test.tsx` | todo |
| 8  | `listar-conversas.ts` traz `fotoHash` e só pede imagem quando há hash `[P]` | AC-6 | 1 | `pnpm vitest run apps/web/src/features/atendimento/application/listar-conversas.test.ts` | todo |
| 9  | `fn_conversas_para_foto_inicial` + função `atendimento-preencher-fotos` | AC-13 | 4 | `deno test supabase/functions/atendimento-preencher-fotos/index.test.ts` | todo |
| 10 | Runbook do preenchimento inicial em `docs/runbooks/` `[P]` | AC-13 | 9 | revisão humana | todo |
| 11 | Auditoria de log: nenhuma URL do WhatsApp, byte ou número `[P]` | AC-11 | 5 | `deno test ... --filter "log sem url"` | todo |
| 12 | Débito em `docs/SECURITY_DEBT.md` (exclusão a pedido apaga fotos) | — | 1 | revisão humana | todo |
| 13 | Glossário: foto do contato, estado da consulta | — | — | `grep` em `docs/glossary.md` | todo |

## Plano de teste

- **Unidade:** assinatura de arquivo — JPEG, PNG, WebP válidos; PNG com `content-type: image/jpeg`
  (aceito pela assinatura, mime corrigido); arquivo de texto com nome `.jpg` (recusado); SVG (recusado);
  arquivo de 1 MB + 1 byte (recusado); host fora do WhatsApp (recusado); URL HTTP (recusada).
- **DB (pgTAP, `db-tests` não pulado):** reserva dentro da janela devolve `false`; duas reservas
  concorrentes, só uma `true`; `sem_foto` apaga e zera `foto_hash`; CHECK de `guardada` exige mime e
  hash; RLS nega `anon` e `authenticated`; `fn_conversas_para_foto_inicial` respeita o teto e não
  repete.
- **Integração:** a mensagem entra e chega ao Zé **antes** de a foto resolver (fake lento);
  exceção na busca não chega ao caminho da mensagem; mensagem duplicada não dispara segunda consulta;
  mensagem do aparelho não dispara.
- **Aceite:** um teste por AC-1..AC-14.
- **Smoke real:** dois celulares — um com foto pública, um com foto oculta — mandando mensagem para o
  canal de teste; conferir foto e iniciais nas três telas em até 1 minuto.

## Divergências (SPEC_DEVIATION)

- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done

- [ ] Todos os AC verdes **pelo gate executável**
- [ ] CI verde no PR (`db-tests` **não pulado**)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Débito registrado em `docs/SECURITY_DEBT.md`
- [ ] Runbook do preenchimento inicial publicado
- [ ] Glossário atualizado
- [ ] `docs/STATE.md` atualizado via `/handoff`
