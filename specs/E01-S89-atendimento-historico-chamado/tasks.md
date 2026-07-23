---
name: tasks-E01-S89-atendimento-historico-chamado
description: Decomposição — anexar histórico WhatsApp a Chamado.
alwaysApply: false
---

# Tasks — Histórico WhatsApp → Chamado

## Plano
| #  | Task                                                          | Cobre AC | Depende de | Gate (comando)  | Status |
|----|---------------------------------------------------------------|----------|------------|-----------------|--------|
| 1  | Contrato de vínculo histórico↔Chamado (snapshot imutável)     | AC-1,3   | E01-S88    | `pnpm test`     | todo   |
| 2  | Migration: tabela de snapshots de conversa por Chamado        | AC-1,3   | 1          | pgTAP           | todo   |
| 3  | Seleção de janela (X dias) + coleta de mensagens              | AC-1     | 2          | `pnpm test`     | todo   |
| 4  | UI no inbox: ação "enviar histórico para Chamado" + seleção   | AC-1,2   | 3          | browser         | todo   |
| 5  | Exibir snapshot no detalhe do Chamado                         | AC-1     | 2          | browser         | todo   |

## Plano de teste
- Unidade: recorte por janela, snapshot imutável (novo anexo = novo registro).
- Aceite: um teste por AC.

## Divergências (SPEC_DEVIATION)
- [ ] Fronteira Atendimento↔PCM — se precisar import cross-domínio, registrar e resolver via contrato.

## Checklist de Definition of Done
- [ ] AC-1..AC-3 verdes
- [ ] `pnpm run ci:local` verde
- [ ] `docs/STATE.md` + ROADMAP atualizados
