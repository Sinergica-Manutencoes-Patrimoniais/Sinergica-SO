---
name: spec
description: Contrato — Config de IA multi-persona (schema + UI + integração com pcm-ze-agent).
alwaysApply: true
---

# Spec — Config: IA + Personas + Base de Conhecimento

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno

## Critérios de aceite

### AC-1: CRUD de personas
- **Dado** um usuário com `podeAcessar('atendimento','escrita')`
- **Quando** cria uma persona com nome/tipo/prompt de sistema
- **Então** a persona aparece na aba "Personas", com `ativo=true` por padrão

### AC-2: Desativar persona não apaga histórico
- **Dado** uma persona em uso (referenciada por `instancias_agente` ou já usada pelo Zé)
- **Quando** desativada (`ativo=false`)
- **Então** some da lista de seleção para novas instâncias, mas vínculos existentes continuam
  funcionando (não há `DELETE`)

### AC-3: `pcm-ze-agent` usa o prompt configurado
- **Dado** a persona `tipo='chamados'` com um prompt customizado
- **Quando** o Zé processa uma mensagem
- **Então** o prompt enviado ao OpenRouter é o texto da persona, não mais uma string fixa no
  código

### AC-4: Vínculo instância→persona
- **Dado** um usuário com escrita
- **Quando** cadastra `instance_id` + persona na aba "Agentes"
- **Então** o vínculo aparece na lista e pode ser desligado (soft-disable) depois

### AC-5: RLS FORCE nas 2 tabelas novas
- **Dado** um usuário sem `atendimento`
- **Quando** tenta acessar `atendimento.personas`/`instancias_agente` diretamente
- **Então** RLS bloqueia (mesmo padrão do resto do módulo)

## Fora de escopo
- Ver `product.md` → Non-goals.

## Rastreabilidade
- Consumida por: `specs/E02-S07-atendimento-flow-builder` (fluxo de qualificação por persona) e
  `specs/E02-S08-atendimento-agente-comercial` (agente que usa a persona `comercial`).
