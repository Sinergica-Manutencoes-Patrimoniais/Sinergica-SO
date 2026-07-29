---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Fix: Auvo 500 ao criar task na transição pra Planejamento

> **Atualização 2026-07-29 (Lucas):** tentou reproduzir de novo e não conseguiu — **tratando como
> intermitência do lado do Auvo a priori**. Sem repro nem log real, não vou mudar `externalId` às
> cegas (arriscaria trocar o lado certo por um chute). Story fica **pausada, sem fix agora** — o
> comportamento de "falha não bloqueia o PCM" (AC-3) já é o que protege o operador nesse meio tempo.
> Reabrir se o erro voltar a acontecer, com log completo dessa vez.

> **Task 0 era bloqueante.** Não mudar `externalId` sem confirmar a causa raiz — evita "consertar" o
> lado errado e mascarar o problema real.

## Plano
| #  | Task                                                                     | Cobre AC | Depende de | Gate (comando)                              | Status |
|----|---------------------------------------------------------------------------|----------|------------|----------------------------------------------|--------|
| 0  | Investigar: logar/inspecionar a resposta completa do Auvo pro request que falhou (não só status 500 — corpo da resposta, headers) | AC-1 | — | Lucas reproduz + captura log real do Auvo | todo |
| 1  | Se hipótese 1 confirmada: trocar `externalId` de `input.osId` (UUID) pra `CH-XXXX` do `chamado_id` vinculado | AC-2 | 0 | teste manual contra Auvo real | todo |
| 2  | Confirmar que falha continua não-bloqueante (`markFailed`, `auvo_sync_status`)  | AC-3     | —          | revisão de código (já existe, só confirmar)   | todo   |
| 3  | Testar retry/reprocessamento manual pós-fix                              | AC-4     | 1          | teste manual                                  | todo   |

## Plano de teste
- Manual (não dá pra automatizar sem credencial real do Auvo, mesmo cuidado já registrado em
  E01-S81/E04-S09/E01-S85): reproduzir o erro original, aplicar o fix, confirmar que a task é criada.
- Regressão: OS que já tinham task criada com sucesso antes deste fix continuam com
  `auvo_task_id` intacto (idempotência não deveria recriar).

## Divergências (SPEC_DEVIATION)
- [ ] Task 0 não pode ser feita por mim (Claude) — não tenho acesso a credencial/logs reais do
  Auvo neste ambiente. Precisa do Lucas rodar e trazer o log completo antes de eu propor o código
  do fix com confiança.

## Checklist de Definition of Done
- [ ] Causa raiz confirmada (task 0)
- [ ] Fix aplicado e testado contra Auvo real
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md` atualizado
