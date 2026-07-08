---
name: spec
description: Contrato — tela de Config do módulo Atendimento (canal por condomínio + catálogo de tags).
alwaysApply: true
---

# Spec — Config: Canais + Tags

> **Fonte da verdade.** Status: aprovado · Tier: Pequeno
> Depende de: `E02-S01` (coluna `atendimento.conversas.tags`).

## Critérios de aceite

### AC-1: Form de canal cria/edita `config_ze` por cliente
- **Dado** um cliente sem linha em `atendimento.config_ze`
- **Quando** um usuário com `podeAcessar('atendimento','escrita')` preenche o form de canal
  (`group_jid`, `bot_jid`, `modo`) e salva
- **Então** uma linha nova é criada em `config_ze` vinculada ao `client_id`
- **E** se já existir linha para aquele cliente, salvar atualiza a existente (upsert por
  `client_id`, que já é `unique`)

### AC-2: CRUD de tags reaproveita o padrão de catálogo simples
- **Dado** um usuário com `podeAcessar('atendimento','escrita')` na tela de Tags
- **Quando** cria uma tag com nome já existente (case-insensitive)
- **Então** a criação é rejeitada com mensagem clara, sem duplicar (mesma validação de
  `catalogos-simples`)

### AC-3: Desativar tag não apaga histórico
- **Dado** uma tag em uso em `conversas.tags` de alguma conversa
- **Quando** o usuário a desativa (`ativo=false`)
- **Então** a tag desaparece da lista de seleção para NOVAS atribuições, mas conversas que já a
  usam continuam mostrando-a normalmente (não há `DELETE`, só soft-disable)

### AC-4: Gate de permissão consistente com o resto do PCM
- **Dado** um usuário sem `atendimento` liberado
- **Quando** acessa a tela de Config
- **Então** vê a tela de acesso restrito; com `leitura` mas sem `escrita`, vê os dados mas sem
  formulários/botões de ação

### AC-5: RLS FORCE na tabela nova
- **Dado** um usuário sem permissão de `atendimento`
- **Quando** tenta select/insert/update em `atendimento.tags` diretamente (bypassando a UI)
- **Então** RLS bloqueia (mesmo padrão de `pcm.segmentos`/`atendimento.conversas`)

## Casos de borda e erros
- Cliente sem `config_ze` ainda: form aparece vazio/em branco pronto para preencher (não é erro).
- `group_jid`/`bot_jid` em branco: permitido salvar (útil pra pré-cadastrar `modo='off'` antes de
  ter a instância Evolution pronta) — só bloqueia salvar sem cliente selecionado.

## Fora de escopo
- Ver `product.md` → Non-goals.

## Rastreabilidade
- Depende de: `specs/E02-S01-atendimento-fundacao/spec.md` (coluna `tags`).
