---
name: tasks
description: Decomposição e gates de E02-S39. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S39 · Mensagem do aparelho tira o Zé

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 0  | **Diagnóstico**: por que a mensagem do celular não aparece hoje. Conferir (a) `supabase functions list` — `pcm-whatsapp-webhook` deployada depois de `44d2cd90`; (b) logs da função com evento `fromMe` chegando; (c) `select direcao, remetente_tipo, origem_envio, count(*) from atendimento.mensagens group by 1,2,3`. Registrar a evidência no PR | AC-0 | — | teste que falha antes e passa depois da correção | todo |
| 1  | ADR `1688-mensagem-do-aparelho-tira-o-ze.md` (inclui a decisão A: corrida aceita) | — | 0 | revisão humana | todo |
| 2  | Migration `1836` — `canal_aparelho`, normalização, validação de textos, RLS force | AC-10, AC-12 | 1 | `pnpm run db:test -- canal_aparelho` | todo |
| 3  | RPCs `fn_ler/fn_salvar_configuracao_do_aparelho` com CAS e validação de pessoa | AC-10, AC-11, AC-12 | 2 | `pnpm run db:test -- configuracao_aparelho` | todo |
| 4  | Migration `1837` — `fn_registrar_mensagem_do_aparelho` (eco, automática, atraso, pausa, fila) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-8 | 2 | `pnpm run db:test -- mensagem_do_aparelho` | todo |
| 5  | `_shared/evolution-aparelho.ts` — porte direto, marcadores, horário, ignorados `[P]` | AC-7, AC-9, AC-13 | — | `deno test supabase/functions/_shared/evolution-aparelho.test.ts` | todo |
| 6  | Webhook despacha `fromMe` para a RPC nova, com `automatica` e `atrasada` resolvidos | AC-1, AC-5, AC-6 | 4, 5 | `deno test supabase/functions/atendimento-evolution-webhook/aparelho.test.ts` | todo |
| 7  | `domain/configuracao-do-aparelho.ts` — validação espelhada no cliente `[P]` | AC-12 | 1 | `pnpm vitest run apps/web/src/features/atendimento/domain/configuracao-do-aparelho.test.ts` | todo |
| 8  | `components/RespostasPeloAparelho.tsx` — select, textarea, CAS, avisos | AC-3, AC-10, AC-11, AC-12 | 3, 7 | `pnpm vitest run apps/web/src/features/atendimento/components/RespostasPeloAparelho.test.tsx` | todo |
| 9  | Rótulo "Mensagem automática do WhatsApp" na bolha (`origem_envio='celular_automatico'`) `[P]` | AC-5 | 4 | `pnpm vitest run apps/web/src/features/atendimento/components/MensagemBubble.test.tsx` | todo |
| 10 | Teste do risco aceito: resposta do Zé já em voo chega mesmo assim, sem corromper estado | AC-2 | 4 | `pnpm run db:test -- aparelho_corrida` | todo |
| 11 | Deixar de chamar `fn_registrar_mensagem_celular` (função permanece, não é apagada) | AC-1 | 6 | `grep -r "fn_registrar_mensagem_celular" supabase/functions` retorna vazio | todo |
| 12 | Glossário: aparelho, responsável do aparelho, texto automático do canal, eco | — | 1 | `grep` em `docs/glossary.md` | todo |
| 13 | `/revisao-adversarial` (tier arquitetural) | todos | 9 | achado reproduzido vira teste | todo |

## Plano de teste

- **Unidade:** `textoDoAparelho` para cada marcador, com e sem legenda, com embrulho de 3 níveis;
  `horarioDoAparelho` com número, string numérica, zero, negativo, `null`;
  `mensagemDoAparelho` recusando grupo, broadcast, `protocolMessage`, `reactionMessage`, e devolvendo
  `null` quando `fromMe !== true`; prova de que `pushName` nunca é lido.
- **DB (pgTAP, `db-tests` não pulado):** **as 6 linhas da matriz de decisão** da spec;
  eco por id; eco por texto dentro e fora da janela de 20 min; `nao_lidas` nunca incrementa;
  `created_at` é o horário do evento, não `now()`; segunda mensagem do aparelho não reatribui;
  CAS recusa versão velha; pessoa inativa recusada; 11 textos recusados; textos repetidos recusados;
  RLS nega colaborador em `canal_aparelho`.
- **Integração:** a `wa_queue` do canal é limpa ao tirar o Zé; conversa já `pausado` não muda de
  responsável.
- **Aceite:** um teste por AC-1..AC-13.
- **Smoke real:** com o canal de teste, responder pelo celular e conferir que (a) a mensagem aparece,
  (b) a conversa fica pausada com a pessoa certa, (c) o Zé não responde depois.

## Divergências (SPEC_DEVIATION)

- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done

- [ ] Todos os AC verdes **pelo gate executável**
- [ ] CI verde no PR (`db-tests` **não pulado**)
- [ ] ADR `1688` registrado antes da implementação, com o risco aceito escrito
- [ ] `/revisao-adversarial` rodada
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] Glossário atualizado
- [ ] `docs/STATE.md` atualizado via `/handoff`
