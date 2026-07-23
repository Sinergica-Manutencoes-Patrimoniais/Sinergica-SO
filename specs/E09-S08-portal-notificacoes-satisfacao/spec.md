---
name: spec-E09-S08-portal-notificacoes-satisfacao
description: Contrato — notificações ao síndico (chamado/OS/laudo) + pesquisa de satisfação (CSAT/NPS) após OS concluída.
alwaysApply: true
tier: pequeno
---

# Spec — Notificações + pesquisa de satisfação

> **Fonte da verdade.** Status: aprovado. Depende de E09-S01 (+ E09-S04/S05/S06 pros eventos que
> notificam). (Ideia nova aprovada pelo PO; liga a E01-S55 pesquisa de satisfação.)

## Resumo
O síndico recebe **notificações** de eventos do seu condomínio (chamado atualizado, OS concluída,
laudo disponível) e responde uma **pesquisa de satisfação** (CSAT/NPS) após uma OS concluída.

## Contexto atual (AS-IS)
- E01-S55 (pesquisa de satisfação) já existe como story do PCM. Eventos-fonte: mudança de status de
  Chamado (E01-S88/E09-S04), OS concluída (`pcm.os_status_eventos`), laudo gerado (E01-S05/E09-S06).

## Critérios de aceite

### AC-1: Notificação de eventos do condomínio
- **Dado** um evento relevante no condomínio do síndico (chamado atualizado / OS concluída / laudo
  disponível)
- **Quando** o evento ocorre
- **Então** o síndico recebe uma notificação (in-app no portal; e-mail se configurado), escopada ao
  seu `cliente_id`.

### AC-2: Central de notificações no portal
- **Dado** notificações geradas
- **Quando** o síndico abre o portal
- **Então** vê a lista das suas notificações (lida/não-lida), sem ver as de outro condomínio.

### AC-3: Pesquisa de satisfação pós-OS
- **Dado** uma OS do condomínio concluída
- **Quando** o síndico é convidado a avaliar
- **Então** responde CSAT/NPS (nota + comentário opcional); a resposta é registrada e vinculada à OS/
  condomínio (alimenta E01-S55).

### AC-4: Não intrusivo
- **Dado** o síndico já avaliou ou dispensou
- **Quando** volta ao portal
- **Então** não é forçado a responder de novo pela mesma OS.

## Casos de borda e erros
- E-mail sem provedor configurado → só notificação in-app, nunca finge envio (padrão E01-S05).
- Evento de outro condomínio → nunca notifica este síndico (RLS/escopo por `cliente_id`).

## Fora de escopo (vinculante)
- Canais push nativos (mobile) — evolução futura.
- Relatórios agregados de satisfação (é do PCM/E01-S55).

## Rastreabilidade
- `apps/web/src/features/area-cliente/` (notificações + pesquisa)
- Migration: tabela de notificações por `cliente_id` (RLS) + respostas de satisfação (ou reusa E01-S55)
- Eventos-fonte: `pcm.os_status_eventos`, eventos de Chamado (E01-S88), laudo (E01-S05)
- Envio e-mail: integração E00-S12 (Resend), degrada sem provedor
