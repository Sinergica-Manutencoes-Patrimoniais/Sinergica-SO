---
name: tasks
description: Decomposição (BLOQUEADA) — Equipamentos CRUD, aguardando decisão do PO.
alwaysApply: false
---

# Tasks — Equipamentos

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 0  | Levantar com Lucas/Fabrício se Equipamentos devem virar CRUD completo no PCM, revertendo a decisão de `E01-S16` ("Auvo é dono, PCM não duplica") — ver `spec.md` → "O que fazer antes de qualquer código" | — | — | resposta do PO registrada em `docs/STATE.md` | todo |
| 1  | **[Bloqueada pela task 0]** Se aprovado: registrar ADR nova (`docs/adr/0006-...`) formalizando a reversão, então preencher `product.md`/`spec.md` completos (o rascunho atual não é definitivo) | — | 0 | revisão humana | todo |
| 2+ | **[Bloqueadas pela task 1]** Decompor migration/descriptor/UI seguindo o padrão de `E01-S28` só depois da ADR aprovada | — | 1 | — | todo |

> Nenhuma task além da 0 deve avançar sem a resposta do PO — este story é intencionalmente curto
> até a decisão vir.

## Divergências (SPEC_DEVIATION)
- [ ] Não aplicável — a story inteira é uma OPEN-QUESTION ao PO, não uma implementação em curso.

## Checklist de Definition of Done
- [ ] Decisão do PO registrada (aprovar reversão de `E01-S16` ou manter o padrão atual)
- [ ] Se aprovado: ADR nova registrada antes de qualquer código
- [ ] Se recusado: story fechada como "não implementada por decisão de produto" (mesmo tratamento
      de `E01-S17` no ROADMAP), sem código nenhum escrito
