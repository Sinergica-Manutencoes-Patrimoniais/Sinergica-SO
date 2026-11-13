---
name: tasks
description: Decomposição e gates de E02-S36. Puxe ao implementar.
alwaysApply: false
---

# Tasks — E02-S36 · Webhook Evolution por canal

## Plano

| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | ADR `1687-webhook-evolution-por-canal.md` | — | — | revisão humana | done |
| 2  | `domain/evento-evolution.ts` — classificador total (lado Vite) | AC-7, AC-8, AC-9 | 1 | `pnpm vitest run apps/web/src/features/atendimento/domain/evento-evolution.test.ts` (42 testes) | done |
| 3  | `atendimento-evolution-webhook/classificar.ts` — espelho (lado Deno) + teste de paridade | AC-7, AC-8, AC-9 | 2 | `deno test .../classificar.test.ts` | done |
| 4  | Migration `1848` (renumerada de `1832`) — `evolution_inbox` + `canal_id` + backfill + idempotência por canal | AC-5 | 1 | `supabase test db` — `evolution_inbox_canal.test.sql` | done (não validado local — ver nota) |
| 5  | RPC `fn_registrar_mensagem_evolution` (reserva + conversa + mensagem no mesmo commit) | AC-5 | 4 | idem, 6 asserts (duplicado, dois canais mesmo id, RLS) | done (idem) |
| 6  | Handler: ordem de verificação (405/404/401/429/415/413/400/409) | AC-1, AC-2, AC-4, AC-6, AC-12 | 3, 5 | `deno test .../handler.test.ts` (16 testes) | done |
| 7  | Teste de que o corpo **não é lido** antes do `401` `[P]` | AC-2 | 6 | idem (prova por corrida: JSON quebrado + segredo errado → 401, nunca 400) | done |
| 8  | Comparação em tempo constante — reusa `_shared/crypto.ts` | AC-3 | 1 | já existente, reusado sem alteração | done |
| 9  | Geração e gravação do segredo por canal no Vault | AC-10 | 5 | `instalar_webhook` (E02-S35) já gera/grava; coberto nos testes de lá | done |
| 10 | `instalar_webhook` da E02-S35 usa a URL nova com canal no caminho | AC-10, AC-11 | 9 | já implementado na própria E02-S35 (task 11) | done |
| 11 | Sinal "recebimento legado — reinstalar" na tela de canais `[P]` | AC-11 | 10 | `pnpm vitest run .../EvolutionTab.test.tsx` | todo |
| 12 | Saúde degradada em `429` e em `401` repetido | AC-12 | 6 | `deno test ... --filter "saude"` | todo (handler não atualiza saúde do canal ainda — nota abaixo) |
| 13 | Glossário: webhook por canal, inbox, chave de idempotência | — | 1 | `grep` em `docs/glossary.md` | todo |
| 14 | `/revisao-adversarial` (tier arquitetural) | todos | 11 | achado reproduzido vira teste | todo |

> **Nota (validação local):** `supabase test db` usa o banco já em execução, não um reset limpo;
> `supabase db reset` local quebra numa migration pré-existente (1273, E01-S185, não relacionada).
> As migrations/RPCs foram verificadas por leitura cuidadosa e pelo padrão já provado em E02-S35
> (CI pegou 3 bugs reais lá — mesmo cuidado aplicado aqui). CI é quem valida de fato.
> **Nota (task 12):** saúde do canal (`registrarSucesso`/`registrarErro`, domínio de E02-S35) ainda
> não é chamada pelo webhook novo — falta fiar o handler na saúde do canal. Registrado como
> pendência real, não feito nesta rodada por tempo.

## Plano de teste

- **Unidade (classificador):** bateria de payloads reais — texto, texto citando, emoji puro, áudio,
  imagem com e sem legenda, vídeo, PDF, figurinha, reação (com e sem emoji), localização, contato,
  enquete, grupo, broadcast, `protocolMessage`, `fromMe`, `ephemeralMessage` aninhado 3×,
  `viewOnceMessageV2Extension`, `documentWithCaptionMessage`, payload vazio, payload com `message: null`.
  **Nenhum caso pode lançar exceção; nenhum tipo desconhecido pode virar `texto`.**
- **Integração (handler):** cada código de resposta da ordem de verificação; corpo de 257 KB;
  `content-type: text/plain`; instância divergente; canal inexistente; segredo errado.
- **DB (pgTAP, `db-tests` não pulado):** idempotência por canal; mesmo `remote_id` em dois canais;
  reserva concorrente; rollback não deixa inbox órfã; RLS nega `anon`/`authenticated` em
  `evolution_inbox`.
- **Aceite:** um teste por AC-1..AC-12.

## Divergências (SPEC_DEVIATION)

- [ ] <task # · motivo · resolução: corrigir código OU atualizar spec/ADR>

## Checklist de Definition of Done

- [ ] Todos os AC verdes **pelo gate executável**
- [ ] CI verde no PR (`db-tests` **não pulado**)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR `1687` registrado antes da implementação
- [ ] `/revisao-adversarial` rodada
- [ ] Glossário atualizado
- [ ] `docs/STATE.md` atualizado via `/handoff`
