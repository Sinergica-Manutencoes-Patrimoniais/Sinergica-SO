---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Categoria "Atendimento Emergencial" com SLA de 2h

> Decidido (Lucas, 2026-07-28): emergencial é um `tipo_os` novo (`"EM"`), não flag ortogonal.
> `CategoriaOs.emergencial` já existe; o que muda é `inferirTipoOsHub` deixar de mapear pra `"C1"`.

## Plano
| #  | Task                                                                     | Cobre AC | Depende de | Gate (comando)                                    | Status |
|----|----------------------------------------------------------------------------|----------|------------|-------------------------------------------------|--------|
| 1  | `domain/hub-os.ts`: `TipoOsHub` ganha `"EM"`; `inferirTipoOsHub` mapeia `categoria === "emergencial"` → `"EM"` (não mais `"C1"`) | AC-1 | — | `pnpm test` (unit `inferirTipoOsHub`) | todo |
| 2  | `calcularPrazoSlaOs`: janela de `"EM"` = abertura + 2h (distinta de C1=4h)  | AC-2     | 1          | `pnpm test` (unit; borda de replanejamento)       | todo   |
| 3  | Migration: se `tipo_os` for coluna com CHECK constraint, adicionar `"EM"` (NOT VALID + VALIDATE separada, padrão da casa) | AC-1 | — | `db-tests` verde                                   | todo   |
| 4  | UI: badge de tipo mostra "Emergencial" + contagem de prazo (2h)            | AC-1,AC-2 | 1,2,3     | Playwright (badge e contagem visíveis)            | todo   |
| 5  | UI: precedência de exibição/ordenação de "EM" na fila do Hub               | AC-3     | 4          | Playwright (emergencial acima de C1)              | todo   |
| 6  | Garantir que tipos não-`"EM"` não disparam "violação de SLA cliente"       | AC-4     | 2          | `pnpm test` (unit)                                | todo   |

## Plano de teste
- Unidade: `inferirTipoOsHub("emergencial")` → `"EM"`; `calcularPrazoSlaOs` para `"EM"` = 2h;
  invariância no replanejamento; tipos não-emergenciais inalterados (C1 continua 4h).
- Integração: persistência do `tipo_os = "EM"`; interação com Hub de OS.
- Aceite: um teste por AC; Playwright para AC-1/AC-2/AC-3 (UI).

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] `db-tests` (RLS/pgTAP) não pulado, se `tipo_os` tiver CHECK constraint no banco
- [ ] `docs/STATE.md` atualizado
