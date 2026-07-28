---
name: tasks
description: Decomposição e gates da feature. Puxe ao implementar.
alwaysApply: false
---

# Tasks — Zé abre chamado a partir do contexto da conversa

> Feature de IA/LLM: antes de codar, acione a trilha `ia/` com `@prompt-engineer` (prompt
> versionado + eval + defesa a prompt injection). Confirmar `X` (janela de contexto) com Lucas.

## Plano
| #  | Task                                                                 | Cobre AC | Depende de | Gate (comando)                                        | Status |
|----|----------------------------------------------------------------------|----------|------------|-------------------------------------------------------|--------|
| 1  | Definir `X` (janela) + prompt versionado que extrai N solicitações   | AC-1, AC-2 | —        | eval do prompt em `ia/` (casos multi-solicitação)     | todo   |
| 2  | Parser do contexto → lista de propostas {titulo, descricao, local}   | AC-2, AC-3 | 1        | `pnpm test` (unit do parser, incluindo local ausente) | todo   |
| 3  | Fluxo de confirmação síncrona (resumo → aguarda "confirma")          | AC-4     | 2          | `pnpm test` (unit da máquina de confirmação)          | todo   |
| 4  | Resolver `clienteId` pela instância/grupo de origem                  | AC-5     | —          | `pnpm test` (unit resolução + caso não-resolvido)     | todo   |
| 5  | Gravar N chamados em `pcm.chamados` (`origem="whatsapp"`) e devolver CH-XXXX | AC-5 | 2,3,4 | teste de aceite no `pcm-ze-agent`                     | todo   |
| 6  | Caso de borda: ambíguo → pergunta; cliente não resolvido → não grava | AC-2, AC-5 | 3,4      | `pnpm test` (unit dos ramos de borda)                 | todo   |

## Plano de teste
- Unidade: parser multi-solicitação, local ausente, máquina de confirmação, resolução de cliente.
- Integração: gravação em `pcm.chamados` com `origem="whatsapp"`.
- Aceite: um teste por AC — foco em AC-2 (dois pedidos = dois chamados) e AC-4 (não grava sem confirmação).
- Eval LLM (`ia/`): precisão de separação de solicitações e extração de local.

## Divergências (SPEC_DEVIATION)
- [ ] <task # · motivo · resolução>

## Checklist de Definition of Done
- [ ] Todos os AC verdes pelo gate executável
- [ ] `X` confirmado com Lucas e registrado na spec
- [ ] Eval do prompt versionado verde (trilha `ia/`)
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] `docs/STATE.md` atualizado
