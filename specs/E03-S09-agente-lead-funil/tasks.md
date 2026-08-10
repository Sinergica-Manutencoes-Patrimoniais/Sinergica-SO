---
name: tasks
description: Decomposição e gates — agente comercial cria oportunidade no funil em vez de gravar em comercial.leads.
alwaysApply: false
---

# Tasks — E03-S09 · Agente comercial entrega o lead no funil

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (E03).
> Branch: `feat/E03-S09-agente-lead-funil`. **Depende de S01 e S02 mergeadas.**
> ⚠️ **Toca Edge Function deployada em produção** (`pcm-ze-agent`). Deploy da function é passo
> explícito — lembrar do achado da sessão de 2026-08-06: function no repo **não** significa
> function deployada.

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Ler `supabase/functions/pcm-ze-agent/index.ts` (~L520–580): o insert em `comercial.leads`, o update de `atendimento.conversas.lead_id` e o upsert em `relacionamento.vinculos`. Mapear os 18 campos e o que cada um vira na oportunidade | AC-3 | — | leitura + anotação nesta tabela | todo |
| 2 | Migration `NNNN_E03-S09_rpc_registrar_oportunidade.sql`: `comercial.fn_registrar_oportunidade(...)` `security definer` — resolve a Conta pelo contato (reusa vínculo ou cria Conta com `auvo_id` nulo), cria a oportunidade com todos os campos, liga a conversa. **Idempotência no banco**: `unique` parcial por `conversa_id` enquanto a oportunidade estiver aberta | AC-1, AC-2, AC-3, AC-5, AC-6 | — | `pnpm run lint:migrations` | todo |
| 3 | Configuração da etapa de entrada do agente (coluna/flag em `comercial.etapas_funil` ou parâmetro), com fallback para a primeira `aberta` | AC-4 | 2 | `pnpm run lint:migrations` | todo |
| 4 | Alterar `pcm-ze-agent`: trocar o insert direto pela chamada da RPC; **remover a escrita em `comercial.leads`**; manter o restante do fluxo intacto | AC-1, AC-8 | 2, 3 | `pnpm run check:edge-functions` | todo |
| 5 | Isolar a falha: `try/catch` em volta do registro, log estruturado, conversa segue normalmente (mesmo padrão de canal isolado da régua de cobrança, E04-S08) | AC-7 | 4 | Deno test | todo |
| 6 | Deno tests do handler: reuso de Conta existente, criação quando não há vínculo, idempotência por conversa (aberta → atualiza; fechada → cria nova), falha do CRM não interrompendo | AC-2, AC-6, AC-7 | 4, 5 | Deno test | todo |
| 7 | Aba Comercial da Visão 360 (S01): link para a conversa que originou a oportunidade | AC-5 | 2 | `pnpm run test` | todo |
| 8 | pgTAP `supabase/tests/comercial_registrar_oportunidade.test.sql`: RPC negando sem `service_role`; idempotência (2ª chamada com mesma conversa não cria 2ª oportunidade aberta); Conta reusada quando há vínculo | AC-1, AC-2, AC-6 | 2 | CI `db-tests` | todo |
| 9 | **Deploy da Edge Function** `pcm-ze-agent` + smoke test: chamada real com payload de teste confirmando que a oportunidade nasce e que `comercial.leads` **não** recebe linha | AC-8 | 4–8 | `supabase functions deploy` + smoke via `supabase db query --linked` | todo |
| 10 | `pnpm run ci:local` + Playwright (dev server local): oportunidade criada pelo agente aparece no funil com score/tier e link da conversa + ROADMAP/STATE | todos | 1–9 | `pnpm run ci:local` | todo |

## Plano de teste
- **pgTAP**: a idempotência (AC-6) precisa ser garantida no banco — retry de Edge Function é
  normal, e duas oportunidades para o mesmo lead sujam toda métrica de conversão da S08.
- **Deno**: o isolamento de falha (AC-7) — provar que o cliente continua sendo atendido mesmo com
  o CRM fora.
- **Smoke em produção**: a única forma de saber que a function foi realmente deployada.

## Riscos
| Risco | Mitigação |
|-------|-----------|
| Function alterada no repo mas não deployada | Task 9 é deploy + smoke explícitos |
| Retry criando oportunidade duplicada | `unique` parcial no banco (task 2), não só lógica na function |
| Conta duplicada para contato que já é cliente | AC-2: resolve pelo vínculo antes de criar |
| Quebrar o atendimento ao cliente por erro no CRM | AC-7 + Deno test (tasks 5, 6) |
| UAT de WhatsApp real continua pendente (herdado da E02-S09) | Declarado fora de escopo; a story entrega o caminho e o smoke test |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate
- [ ] `pnpm run ci:local` verde · Playwright rodado contra dev server local
- [ ] **Edge Function deployada e smoke-testada em produção** (não basta estar no repo)
- [ ] Confirmado que `comercial.leads` parou de receber linha nova (libera a S10)
- [ ] Revisão adversarial (borda: contato sem nome, Conta inativa, funil sem etapa aberta)
- [ ] ROADMAP/STATE atualizados
