---
name: tasks
description: Decomposição e gates de E02-S39. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S39 · Mensagem do aparelho tira o Zé

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 0  | **Diagnóstico**: por que a mensagem do celular não aparece hoje | AC-0 | — | — | **bloqueado — sem acesso a produção neste ambiente** |
| 1  | ADR `1688-mensagem-do-aparelho-tira-o-ze.md` (decisão A: corrida aceita) | — | 0 | revisão humana | done |
| 2  | Migration `1849` (renumerada) — `canal_aparelho`, normalização, validação de textos, RLS force | AC-10, AC-12 | 1 | `supabase test db` — `mensagem_do_aparelho.test.sql` | done (ver nota de validação) |
| 3  | RPCs `fn_ler/fn_salvar_configuracao_do_aparelho` com CAS e validação de pessoa | AC-10, AC-11, AC-12 | 2 | idem, teste 6 (pessoa inativa recusada) | done |
| 4  | Migration `1850` (renumerada) — `fn_registrar_mensagem_do_aparelho` (eco, automática, atraso, pausa, fila) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-8 | 2 | idem, testes 1-5 (matriz de decisão) | done |
| 5  | `_shared/evolution-aparelho.ts` — porte direto, marcadores, horário | AC-7, AC-9, AC-13 | — | `deno test .../evolution-aparelho.test.ts` (10 testes) | done |
| 6  | Webhook despacha `fromMe` para a RPC nova | AC-1, AC-5, AC-6 | 4, 5 | `deno test .../handler.test.ts` (17 testes, todo o pacote) | done |
| 7  | `domain/configuracao-do-aparelho.ts` — validação espelhada no cliente `[P]` | AC-12 | 1 | — | todo |
| 8  | `components/RespostasPeloAparelho.tsx` — select, textarea, CAS, avisos | AC-3, AC-10, AC-11, AC-12 | 3, 7 | — | todo |
| 9  | Rótulo "Mensagem automática do WhatsApp" na bolha | AC-5 | 4 | — | todo |
| 10 | Teste do risco aceito: resposta do Zé já em voo chega mesmo assim | AC-2 | 4 | — | todo (risco documentado no ADR, teste específico não escrito) |
| 11 | Deixar de chamar `fn_registrar_mensagem_celular` no caminho novo (função permanece) | AC-1 | 6 | webhook já chama só `fn_registrar_mensagem_do_aparelho` | done |
| 12 | Glossário: aparelho, responsável do aparelho, texto automático do canal, eco | — | 1 | — | todo |
| 13 | `/revisao-adversarial` (tier arquitetural) | todos | 9 | — | todo |

> **Nota de validação:** mesma ressalva de S36 — `supabase test db` roda contra o banco já em
> execução, não um reset limpo (bloqueado pela migration 1273 pré-existente). Verificado por
> leitura cuidadosa; CI valida de fato.
> **AC-0 permanece aberto.** Sem acesso a produção, não dá pra confirmar a causa raiz do bug
> relatado (mensagem do celular não aparecia). A RPC nova resolve o comportamento **correto** daqui
> pra frente (pausa + atribui + cancela fila), mas não prova que o caminho antigo estava de fato
> quebrado em produção por uma causa específica — isso fica para quem tiver acesso ao projeto.

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
