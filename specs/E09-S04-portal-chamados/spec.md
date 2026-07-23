---
name: spec-E09-S04-portal-chamados
description: Contrato — no Portal do Cliente, abrir e acompanhar Chamados (origem cliente_portal), reusando pcm.chamados de E01-S88.
alwaysApply: true
tier: pequeno
---

# Spec — Chamados no portal (abrir + acompanhar)

> **Fonte da verdade.** Status: aprovado. Depende de E09-S01 e **E01-S88** (entidade Chamado).

## Resumo
O síndico abre um Chamado pelo portal (`origem='cliente_portal'`) e acompanha o andamento dos seus
Chamados (status + histórico de eventos), tudo escopado ao `cliente_id`.

## Contexto atual (AS-IS)
- E01-S88 cria `pcm.chamados` (entidade própria, numeração `CH-XXXX`, origem incl. `cliente_portal`,
  eventos append-only) e já prevê exposição no Portal do Cliente (tela deixada para E09). Aqui é a tela.

## Critérios de aceite

### AC-1: Abrir Chamado pelo portal
- **Dado** um síndico logado
- **Quando** preenche e envia um novo Chamado (título, descrição, anexo opcional)
- **Então** é criado um Chamado com `origem='cliente_portal'`, vinculado ao **seu** `cliente_id`,
  numeração `CH-XXXX`, status inicial de abertura.

### AC-2: Acompanhar os próprios Chamados
- **Dado** o síndico
- **Quando** abre a lista de Chamados
- **Então** vê **apenas** os Chamados do seu condomínio (RLS `cliente_id`), com status e histórico de
  eventos (append-only) legível — sem notas internas.

### AC-3: Interagir no Chamado (comentário/anexo do cliente)
- **Dado** um Chamado aberto do síndico
- **Quando** ele adiciona um comentário/anexo
- **Então** o registro é anexado ao Chamado (append-only), visível ao time interno, notificando (a
  notificação em si é E09-S08).

### AC-4: Não pode cancelar/decidir destino
- **Dado** um Chamado do síndico
- **Quando** ele visualiza
- **Então** **não** tem ações internas (cancelar com justificativa, gerar OS, enviar backlog) — essas
  são do time interno (E01-S88). O síndico só abre, acompanha e comenta.

## Casos de borda e erros
- Anexo grande/tipo inválido → validar antes de subir (Storage privado).
- Tentativa de acessar Chamado de outro cliente por ID → RLS retorna nada (garantido no banco).

## Fora de escopo (vinculante)
- Fluxo interno do Chamado (cancelamento, virar OS, backlog) — E01-S88.
- Notificação de mudança — E09-S08.

## Rastreabilidade
- `apps/web/src/features/area-cliente/` (seção Chamados)
- Reusa `pcm.chamados` + eventos (E01-S88); RLS por `cliente_id` estendida a essas tabelas
- Storage de anexo: bucket de chamados (criado em E01-S88) + signed URL
