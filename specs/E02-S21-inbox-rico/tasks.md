---
name: tasks
description: Decomposição e gates — inbox rico.
alwaysApply: false
---

# Tasks — Inbox rico (paridade de composição)

## Plano
| #  | Task | Cobre AC | Depende de | Gate (comando) | Status |
|----|------|----------|------------|----------------|--------|
| 1  | Tipos ricos + validação por canal | AC-1,AC-2,AC-3 | — | testes de domínio | feito |
| 2  | Migrations `0063/0064`, bucket privado e RLS | AC-1 | — | pgTAP escrito | feito; execução pendente |
| 3  | Gravação/anexo, upload privado, envio Evolution e preview | AC-1 | 1 | typecheck/build | feito |
| 4  | Composer de templates aprovados + placeholders | AC-2 | 1 | typecheck/build | feito |
| 5  | Composer de botões + resposta extraída no webhook | AC-3 | 1 | testes/build | feito |
| 6  | Badge de canal + aplicar/remover tags na conversa | AC-4 | 1 | typecheck/build | feito |
| 7  | Gates + ROADMAP/STATE | todos | 1–6 | comandos individuais | feito |

## Plano de teste
- Unidade: tipos de mensagem + suporte por canal (borda). Componente: cada compositor + badge/tags. Aceite: 1 por AC.

## Divergências (SPEC_DEVIATION)
- [x] Testes DOM não disponíveis; componentes validados por domínio, typecheck e build. UAT real
  permanece obrigatório porque os endpoints ricos variam por versão da Evolution.

## Checklist de Definition of Done
- [ ] Todos os AC verdes (falta pgTAP/UAT Evolution)
- [x] Nenhum `SPEC_DEVIATION` pendente
- [x] Spec reflete o que foi construído
- [x] `docs/STATE.md` atualizado
