---
name: spec
description: Contrato da feature (critérios de aceite). Base enquanto a feature está ativa.
alwaysApply: true
---

# Spec — Responsável pelo cliente (representante) no cadastro do cliente

> **Fonte da verdade.** Status: rascunho
> Origem: reunião Fabrício × Lucas (2026-07-27). Item 12.

## Resumo
Registrar quem é o **responsável / representante do cliente** (síndico, gerente predial, etc.) no
cadastro do cliente no PCM. Além do valor de negócio (saber com quem falar), essa informação é
insumo para o Zé definir "quem pode solicitar abertura de chamado" (base para E02-S23/E02-S24).

## Decisões travadas (reunião)
- Fabrício: importante ter o representante do cliente cadastrado ("igual tem o representante do
  cliente, seria importante colocar isso").
- Pode haver **mais de um** representante por cliente (síndico + gerente + zelador, etc.).

## Critérios de aceite

### AC-1: Cadastrar responsável no cliente
- **Dado** o cadastro de um cliente
- **Quando** o operador adiciona um responsável (nome, papel, contato/telefone)
- **Então** o responsável é persistido e vinculado ao cliente.

### AC-2: Múltiplos responsáveis
- **Dado** um cliente que já tem um responsável
- **Quando** o operador adiciona outro
- **Então** ambos ficam associados ao cliente (lista de responsáveis).

### AC-3: Exibição no resumo do cliente
- **Dado** um cliente com responsável(is)
- **Quando** o operador abre o resumo do cliente
- **Então** os responsáveis aparecem (nome, papel, contato).

### AC-4: Editar/remover responsável
- **Dado** um responsável cadastrado
- **Quando** o operador edita ou remove
- **Então** a alteração é persistida (remoção é soft/auditável se o padrão do projeto exigir).

## Casos de borda e erros
- Contato (telefone) inválido → validação de formato, avisa sem travar o resto do cadastro.
- Cliente sem responsável → permitido (campo não obrigatório no MVP).

## Fora de escopo
- Autenticação/login do responsável (não há acesso externo — Área do Cliente descartada, item 14).
- Regra de "quem pode abrir chamado pelo WhatsApp" (consumirá este dado, mas é E02-S23/S24).

## Rastreabilidade
- Código: cadastro de clientes em `apps/web/src/features/pcm/` (`pcm.clientes`).
- ADRs relacionados: —
