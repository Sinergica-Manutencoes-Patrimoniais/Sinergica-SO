---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Trigger de resposta automática do Zé

> **Achado importante ao investigar o código (2026-07-28):** `atendimento.personas` **já tem**
> `janela_inicio`, `janela_fim`, `janela_dias` (array de dias da semana) + a tela de config
> (`AtendimentoConfigPage.tsx`) provavelmente já edita isso — é a mesma forma pedida por Lucas
> (dia da semana + horário). **Mas a semântica hoje é invertida**: `personaDisponivelAgora`
> (`pcm-ze-agent/index.ts:628`) usa essas colunas como janela em que o Zé **pode** responder
> (gate pro acionamento manual/`@zé`, E02-S23) — E02-S25 quer o oposto: Zé responde automático
> **fora** dessa janela (ou após X min sem humano) **dentro** dela. Não dá pra reusar a mesma
> coluna com o mesmo significado sem quebrar o gate atual. Antes da task 1, decidir com
> `@architect`: (a) reinterpretar `janela_*` como "horário humano" e inverter a lógica em
> `personaDisponivelAgora`+trigger novo, ou (b) colunas novas separadas. Recomendação: (a),
> reaproveitando o schema existente, mas exige revisar todo `deveAcionarZe`/`personaDisponivelAgora`
> junto — não é uma feature isolada, é um ajuste na função que já está em produção.

## Plano
| #  | Task                                                                  | Cobre AC       | Depende de | Gate (comando)                                   | Status |
|----|-----------------------------------------------------------------------|----------------|------------|--------------------------------------------------|--------|
| 0  | Decidir reconciliação com `janela_inicio/fim/dias` existente (achado acima) | —        | —          | revisão @architect                                | todo   |
| 1  | Tela de config: horário por dia da semana + `X` min (reusa/estende `AtendimentoConfigPage.tsx`) | AC-5,AC-6 | 0 | Playwright (salva e recarrega config)   | todo   |
| 2  | Domínio: `deveResponderAutomaticamente(estado)` (matriz de decisão)   | AC-1,AC-2,AC-4 | 0          | `pnpm test` (unit cobrindo as 4 linhas da matriz)| todo   |
| 3  | Detecção de handoff (cliente pede humano) + estado "atendimento humano"| AC-3          | —          | `pnpm test` (unit do detector + estado)          | todo   |
| 4  | Reativação após handoff (volta ao automático na próxima janela)       | AC-3           | 3          | `pnpm test` (unit da transição de volta)         | todo   |
| 5  | Ligar no `pcm-ze-agent`: aplicar decisão no fluxo de mensagem, sem quebrar `deveAcionarZe`/`personaDisponivelAgora` (E02-S23) | AC-1,AC-2,AC-3 | 1,2,3 | teste de aceite no `pcm-ze-agent` | todo |

## Plano de teste
- Unidade: `deveResponderAutomaticamente` (função pura sobre horário/inatividade/handoff) — as 4
  linhas da matriz de decisão são casos de teste diretos.
- Regressão: `personaDisponivelAgora`/`deveAcionarZe` (gate do acionamento manual, E02-S23)
  continuam corretos após a reconciliação da task 0.
- Integração: aplicação no fluxo de mensagem da Edge Function.
- Aceite: um teste por AC; Playwright para AC-6 (tela de config).

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Reconciliação com `janela_inicio/fim/dias` decidida e registrada (task 0)
- [ ] Todos os AC verdes pelo gate executável
- [ ] Regressão do gate de acionamento manual (`deveAcionarZe`) sem quebrar
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md` atualizado
