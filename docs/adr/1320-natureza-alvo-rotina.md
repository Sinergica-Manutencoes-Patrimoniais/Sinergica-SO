---
name: "docs-adr-1320-natureza-alvo-rotina-md"
description: "Documento Sinérgica SO: ADR-1320 — Natureza explícita de alvo em cadastro compartilhado"
alwaysApply: false
---

# ADR-1320 — Natureza explícita de alvo em cadastro compartilhado

## Decisão

Equipamentos e Componentes permanecem em `pcm.equipamentos`, com IDs,
códigos e menus existentes. Rotina cujo tipo legado é `componente` pode
receber natureza técnica explícita `equipamento` ou `componente`; ausência
significa não declarada, nunca classificação presumida. Sistemas e Grupos não
recebem essa natureza.

A declaração é uma alteração auditada e idempotente da Rotina em rascunho,
com revisão do Plano e permissão atual. Mudança do alvo remove a declaração
anterior. Versões aprovadas e snapshots antigos não são modificados. Novos
snapshots já usam `to_jsonb` da Rotina, mas a compatibilidade e a cópia em
novas versões precisam ser verificadas antes de liberar o gate.

Na revisão do mesmo Plano, a cópia pode herdar apenas natureza explícita da
última fotografia aprovada quando Rotina lógica e alvo coincidem. Snapshot
sem natureza permanece não declarado; origem ambígua ou natureza inválida
não é convertida automaticamente. A cópia entre Planos/modelos continua
dependendo de tratamento próprio.

Na cópia integral de Plano do mesmo Cliente, a natureza pode ser preservada
apenas após conferir o hash da fotografia, o mapa de Rotinas e o mesmo alvo.
Na cópia de uma Rotina para outro alvo, permanece não declarada até revisão
humana; o tipo do alvo novo não é inferido pelo modelo de origem.

## Limites

Migration e comando ficam preparados, gate desligado. Ainda é necessário
integrar formulário, listagem, cópia/revisão, importações, snapshots e
consumidores de ocorrência. Não inferir classificação de registros antigos.
Validar concorrência, autorização, cópia, aprovação, RLS/FORCE e revisão
adversarial antes de habilitar.
