---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Funcionário: perfil completo

> Tier pequeno-médio (consolidação de leitura + UI; sem migration). Reusa agenda/OS/horas/ferramentas.

## Plano
| #  | Task | Cobre AC | Gate (comando) | Status |
|----|------|----------|----------------|--------|
| 1 | Application/adapters: consolidar por funcionário — cadastro + alocação dia/semana + OS atendidas + ferramentas em posse | AC-1..AC-4 | typecheck | todo |
| 2 | Domínio: agregações (contagem de OS por período, alocação da semana) puras/testáveis | AC-2,AC-3 | vitest | todo |
| 3 | UI: perfil/detalhe do funcionário com as 4 seções + atalhos (lista de OS, histórico ferramenta) | AC-1..AC-4 | typecheck | todo |
| 4 | Estados vazios + degradação (inativo, sem Auvo) | AC-5,AC-borda | vitest | todo |
| 5 | e2e: abrir funcionário mostra dados/alocação/OS/ferramentas | AC-1..AC-4 | playwright (Lucas) | todo |

## Plano de teste
- Unidade: contagem de OS por período; alocação da semana; estados vazios.
- Aceite: Playwright — perfil completo abre com as 4 seções corretas.

## Checklist de Definition of Done
- [ ] AC verdes pelo gate
- [ ] Playwright local (Lucas)
- [ ] ROADMAP.md + STATE.md atualizados
