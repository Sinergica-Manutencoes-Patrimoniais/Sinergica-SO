---
name: spec
description: Contrato — editor visual de fluxo de qualificação (atendimento.fluxos).
alwaysApply: true
---

# Spec — Config: Flow-builder visual

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno
> Depende de: `E02-S06` (`atendimento.personas`).

## Critérios de aceite

### AC-1: Criar fluxo vinculado a uma persona
- **Dado** um usuário com escrita
- **Quando** cria um fluxo com nome + persona
- **Então** o fluxo aparece na lista, sem passos (`definicao=[]`)

### AC-2: Adicionar/editar/remover passos no canvas
- **Dado** um fluxo selecionado
- **Quando** o usuário adiciona um passo, edita campo/pergunta/obrigatório, ou remove um passo
- **Então** as mudanças ficam no estado local até "Salvar passos" ser clicado (sem escrita
  parcial/automática no banco a cada tecla)

### AC-3: Salvar persiste a definição inteira
- **Dado** passos editados no canvas
- **Quando** o usuário clica "Salvar passos"
- **Então** `atendimento.fluxos.definicao` é substituída pelo array completo (ordenado por
  `ordem`), validado (todo passo precisa de `campo`/`pergunta` não-vazios)

### AC-4: Desativar fluxo não apaga
- **Dado** um fluxo em uso
- **Quando** desativado
- **Então** `ativo=false`, sem `DELETE`

### AC-5: RLS FORCE
- **Dado** um usuário sem `atendimento`
- **Quando** tenta acessar `atendimento.fluxos` diretamente
- **Então** RLS bloqueia

## Fora de escopo
- Ver `product.md` → Non-goals.

## Rastreabilidade
- Consumida por: `specs/E02-S08-atendimento-agente-comercial`.
