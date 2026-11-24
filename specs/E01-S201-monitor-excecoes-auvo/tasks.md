---
name: tasks
description: "Decomposição e gates de E01-S201. Puxe ao implementar."
alwaysApply: false
---

# Tasks — E01-S201 · Monitor consolidado de exceções do Auvo (T−24)

Detalhe técnico e inventário em `plan.md`.

| # | Task | Cobre AC | Gate (comando) | Status |
|---|------|----------|----------------|--------|
| 1 | Inventário das três famílias: onde mora falha de envio, Visita não confirmada e tarefa órfã | — | relatório no `plan.md`; nada novo sem justificativa | **done** — as três existem separadas; nenhuma consulta as reúne; "Visita não confirmada" não tinha nem onde ser lida |
| 2 | Migration `1867`: `pcm.sso_listar_excecoes_auvo_t24`, reusando gate de `1427` e capacidade `execucao.validar` | AC-1, AC-2, AC-7, AC-11 | `node scripts/lint-migrations.mjs` | **done** — sem gate, capacidade, tabela ou coluna nova |
| 3 | Recorte da família "falha de envio" (parada no livro T−24, `fence` como tentativas) | AC-3 | `supabase test db` | **done** |
| 4 | Recorte da família "Visita não confirmada" (janela aberta, vínculo vigente, sem tentativa) | AC-4 | `supabase test db` | **done** |
| 5 | Família "tarefa órfã" por **chamada** a `sso_listar_campo_a_conciliar` (1866), sem copiar predicado | AC-5 | `supabase test db` | **done** — "órfã" continua com uma só definição |
| 6 | pgTAP: permitido e negado, gate fechado com erro nomeado, isolamento por Cliente | AC-3, AC-4, AC-5, AC-6, AC-8, AC-9 | `npx supabase test db supabase/tests/E01-S201_*.test.sql` | **done** — 17 asserções, todas verdes |
| 7 | `domain/excecoes-auvo.ts` — tipos, rótulos, contagem e `avisoMonitorExcecoes`, puros | AC-10 | `pnpm vitest run src/features/pcm/domain/excecoes-auvo.test.ts` | **done** — 16 testes verdes |
| 8 | Adapter com Zod `.strict()`, chave de query e `useQuery` com `retry: false` | AC-1, AC-2, AC-F4 | `pnpm run typecheck` | **done** |
| 9 | `MonitorExcecoesAuvoPage` com as oito colunas do AC-2 e contadores por família | AC-1, AC-2, AC-F1 | `pnpm run typecheck` | **done** |
| 10 | Item "Monitor Auvo (T−24)" no grupo OPERAÇÃO do PCM | AC-F1 | revisão humana | **done** |
| 11 | Flag declarada no registro, `.env.example` e `netlify.toml`, nascendo `false` | AC-F2 | `node scripts/check-flags-declaradas.mjs` | **done** |
| 12 | Sete frases distintas para desligado/sem Cliente/gate/capacidade/erro/vazio | AC-10, AC-F3 | teste da task 7 | **done** — distinção provada por teste |
| 13 | Procedimento de abertura e de retorno, com o aviso do gate compartilhado | AC-F4 | revisão humana | **done** — `plan.md` §4 |
| 14 | Linha de ativação no PR | AC-F5 | revisão humana | **done** — falta abrir gate + ligar flag + conceder `execucao.validar` |

## Fatia seguinte (fora desta story, por decisão explícita)

- **Reprocessar falha a partir do monitor.** É escrita: precisa de `request_id` idempotente,
  capacidade própria (provavelmente `execucao.contingencia_auvo` ou uma nova), auditoria em
  `audit.events` e re-entrada controlada no livro de tentativas (`estado` volta de
  `incerto`/`reconciliacao` para `aguardando` só quando a reconciliação provar que não há tarefa
  remota). Nada disso cabia numa consulta de leitura, e um botão que não faz nada seria pior que
  botão nenhum.
- **Histórico além de 72h** para a família "Visita não confirmada": o recorte atual mostra o que
  ainda é acionável. Visita cujo fim passou há mais de 72h some do monitor. Transformar isso em
  indicador histórico (quantas Visitas por mês deixaram de virar tarefa) é relatório, não monitor.
- **Consolidação multi-Cliente numa chamada só**: exige decidir o que fazer com Cliente em que o
  ator não tem `execucao.validar` (omitir silenciosamente mentiria sobre o total).
- **Alerta ativo** (e-mail/WhatsApp) quando uma exceção nasce — o pacote cita "alerta", mas isso é
  canal, não tela.
- **Gate próprio**, se um dia a operação quiser ligar o monitor sem ligar a fila "Campo a
  conciliar". Hoje o gate é compartilhado de propósito (ver `plan.md` §2.1 e §4).

## Definition of Done

- pgTAP com permitido **e** negado (SC-001); cada família com um caso que entra e um que não entra
  (SC-002); isolamento por Cliente (SC-003).
- Migration sequencial, aditiva, com reverso escrito no cabeçalho.
- Sem `return null` silencioso; todo estado desligado tem frase própria.
- Nenhum SPEC_DEVIATION pendente.
- CI verde.

## Rastreabilidade AC→task (completa)

Lista literal para a auditoria (`eval:spec`), que não expande faixa: AC-1, AC-2, AC-3, AC-4, AC-5,
AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-F1, AC-F2, AC-F3, AC-F4, AC-F5.
