---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Tela de abertura de chamado com os campos da OS + descrição completa

> AC-6 absorve o bug do modal (item 8 da lista: dados somem ao trocar de aba).

## Plano
| #  | Task                                                                | Cobre AC | Depende de | Gate (comando)                                | Status |
|----|---------------------------------------------------------------------|----------|------------|-----------------------------------------------|--------|
| 1  | Migration: `data_abertura`, `data_planejada`, `data_execucao`, `replanejamentos` em `pcm.chamados` | AC-2,AC-3,AC-4 | — | `db-tests` verde                        | todo   |
| 2  | Domínio: regras das 3 datas (abertura imutável, contador de replanejamento, validações de ordem) | AC-2,AC-3,AC-4 | — | `pnpm test` (unit)                     | todo   |
| 3  | Formulário de abertura com todos os campos da OS                    | AC-1     | 1          | Playwright (campos presentes)                 | todo   |
| 4  | Detalhe do chamado mostra Solicitação + Local completos             | AC-5     | —          | Playwright (texto não truncado)               | todo   |
| 5  | Fix: persistir estado do modal ao trocar de aba                     | AC-6     | —          | Playwright (troca de aba preserva dados)      | todo   |
| 6  | Registrar data de execução distinta e cálculo SLA abertura→execução | AC-4     | 1,2        | `pnpm test` (unit do cálculo)                 | todo   |

## Plano de teste
- Unidade: invariância da data de abertura, contador de replanejamento, validações de ordem de datas.
- Integração: persistência das colunas novas.
- Aceite: Playwright para AC-1, AC-5, AC-6; unit para AC-2/AC-3/AC-4.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] Playwright rodado localmente (bug do modal comprovadamente corrigido)
- [ ] `db-tests` não pulado
- [ ] `docs/STATE.md` atualizado
