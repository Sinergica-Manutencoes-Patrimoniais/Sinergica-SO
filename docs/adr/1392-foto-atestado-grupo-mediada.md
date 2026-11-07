---
name: "docs-adr-1392-foto-atestado-grupo-mediada-md"
description: "Documento Sinérgica SO: ADR-1392 — Foto declarada de Grupo mediada"
alwaysApply: false
---

# ADR-1392 — Foto declarada de Grupo mediada

Entradas autenticadas independentes expõem metadados de fotos candidatas e registradas e declaração de vínculo, sob `execucao.validar`, com gates novos fechados. Núcleos existentes seguem privados. A interface verifica sessão, ordem das páginas, seleção, revisão e tentativa. Nenhum endereço do objeto é retornado por essas entradas.

O vínculo é declarativo: não autentica imagem, autoria ou execução, nem encerra OS ou envia tarefas. Antes de abrir gates, aplicar e testar migrations coordenadas, ACL/RLS/FORCE, privacidade e Storage reais, revogação, replays, concorrência, supressão de Visita e revisão adversarial.
