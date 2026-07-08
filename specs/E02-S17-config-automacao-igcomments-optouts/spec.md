---
name: spec
description: Contrato — abas "Coment. IG" (automações de comentário) e "Opt-outs", paridade heziomos.
alwaysApply: true
---

# Spec — Config de automação: Comentários IG + Opt-outs

> **Fonte da verdade.** Status: rascunho · Tier: Pequeno
> Duas abas de governança do heziomos ausentes.

## Resumo
Adiciona a aba "Coment. IG" (automações que respondem/movem comentários do Instagram para DM) e a aba
"Opt-outs" (gestão de contatos que pediram para não receber mensagens).

## Critérios de aceite

### AC-1: Automações de comentário IG
- **Dado** a aba Coment. IG
- **Quando** o usuário cria/edita/desativa uma regra (gatilho por palavra/post → ação: responder/DM)
- **Então** a regra persiste (RLS FORCE) e passa a ser aplicada aos comentários

### AC-2: Gestão de opt-outs
- **Dado** a aba Opt-outs
- **Quando** um contato opta por sair (ou é adicionado manualmente)
- **Então** ele entra na lista de opt-out e o sistema não dispara mensagens ativas para ele

### AC-3: Gating por papel
- **Dado** usuário sem permissão
- **Quando** acessa/edita
- **Então** é bloqueado (RLS + gate de UI)

## Casos de borda e erros
- Regra IG sem gatilho → validação impede salvar.
- Contato em opt-out recebendo tentativa de envio ativo → bloqueado com log claro.

## Fora de escopo
> Vinculante. Não implementar nada aqui.
- Conexão do canal Instagram — `E02-S16`. Scoring/clusters — `E02-S18`.

## Rastreabilidade
- Product: `./product.md`
- Referência heziomos: `IgCommentAutomationsTab`, `FlowOptoutsTab`.
- Âncora Sinergica: `AtendimentoConfigPage.tsx`.
