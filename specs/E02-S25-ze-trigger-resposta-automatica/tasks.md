---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Trigger de resposta automática do Zé

> Confirmar horário comercial e `X` (minutos) com Lucas/Fabrício antes de codar.

## Plano
| #  | Task                                                                  | Cobre AC       | Depende de | Gate (comando)                                   | Status |
|----|-----------------------------------------------------------------------|----------------|------------|--------------------------------------------------|--------|
| 1  | Config global (horário comercial + `X` min) — modelo + leitura        | AC-5           | —          | `pnpm test` (unit da config)                     | todo   |
| 2  | Domínio: `deveResponderAutomaticamente(estado)` (matriz de decisão)   | AC-1,AC-2,AC-4 | 1          | `pnpm test` (unit cobrindo as 4 linhas da matriz)| todo   |
| 3  | Detecção de handoff (cliente pede humano) + estado "atendimento humano"| AC-3          | —          | `pnpm test` (unit do detector + estado)          | todo   |
| 4  | Reativação após handoff (volta ao automático na próxima janela)       | AC-3           | 3          | `pnpm test` (unit da transição de volta)         | todo   |
| 5  | Ligar no `pcm-ze-agent`: aplicar decisão no fluxo de mensagem         | AC-1,AC-2,AC-3 | 2,3        | teste de aceite no `pcm-ze-agent`                | todo   |

## Plano de teste
- Unidade: `deveResponderAutomaticamente` (função pura sobre horário/inatividade/handoff) — as 4
  linhas da matriz de decisão são casos de teste diretos.
- Integração: aplicação no fluxo de mensagem da Edge Function.
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Horário comercial e `X` confirmados e registrados na spec
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md` atualizado
