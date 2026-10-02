---
name: tasks
description: Tasks e gates — preventivas PCM com execução no Auvo.
alwaysApply: false
---

# Tasks — Preventivas no PCM, execução no Auvo

| # | Task | AC | Depende | Gate | Status |
|---|------|----|---------|------|--------|
| 1 | Validar POST/GET Auvo com task futura, técnico, questionário, alvo Sistema/Componente e chave estável; registrar evidência sanitizada no design | AC-2, AC-3, AC-4, AC-5 | acesso de teste autorizado | contrato real documentado | todo |
| 2 | Fechar design/ADR com campos comprovados, estados, reconciliação, payload de avaliação/local e tratamento de ciclos passados | AC-1, AC-3, AC-4, AC-5 | 1 | revisão arquitetural | todo |
| 3 | Migration aditiva de planos, ocorrências, vínculos, resultados e achados; índices, RLS FORCE, audit e pgTAP permitido/negado | AC-1, AC-4, AC-5, AC-6, AC-7 | 2 | `pnpm run lint:migrations`; `db-tests` | todo |
| 4 | Domínio com testes de recorrência ancorada, fim de mês, pausa, atraso e geração idempotente | AC-1, AC-7 | 3 | testes focados | todo |
| 5 | Casos de uso e UI de plano para Sistema/Componente, questionário obrigatório, ativação/pausa | AC-1, AC-7 | 3, 4 | testes focados | todo |
| 6 | Calendário/drawer com vencimento, visita, alvo/itens, estados e confirmação de Fabrício | AC-2, AC-3 | 5 | teste de UI | todo |
| 7 | Criação imediata Auvo, leitura de confirmação, vínculo, bloqueio de questionário incerto, falha/retry idempotente | AC-3, AC-4 | 1-3, 6 | teste integração | todo |
| 8 | Sync idempotente de status, respostas, fotos, medições e local por avaliação de Sistema | AC-5 | 3, 7 | teste de reentrega/ordem | todo |
| 9 | Triagem de achados e envio manual individual ao backlog, com origem e deduplicação | AC-6 | 8 | teste de decisão/repetição | todo |
| 10 | Validar plano de Sistema e Componente ponta a ponta; revisão adversarial, `pnpm run ci:local`, CI `db-tests` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | 1-9 | gates verdes | todo |

Task 7 bloqueada até task 1 comprovar POST/GET com questionário e alvo corretos. Resultado de
POST sem leitura conclusiva não satisfaz gate; task parcial nunca fica disponível ao técnico.

## Divergências (SPEC_DEVIATION)

- [ ] Nenhuma divergência aberta.
