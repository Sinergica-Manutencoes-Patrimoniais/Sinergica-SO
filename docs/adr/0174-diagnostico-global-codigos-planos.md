---
name: "docs-adr-0174-diagnostico-global-codigos-planos-md"
description: "Documento Sinérgica SO: ADR-0174 — Agregados cruzados e prévia de planos legados"
alwaysApply: false
---

# ADR-0174 — Agregados cruzados e prévia de planos legados

Status: proposta, não homologada.

Com superadmin ativo, `plano.gerir` do Cliente e gate fechado, diagnóstico agregado informa quantas chaves de código atuais ou aliases do Cliente podem coincidir, após comparação por caixa e espaços, com códigos de outros Clientes; nunca retorna códigos, identidades ou Cliente externo. Resultado é suspeita e não prova duplicidade ou regra universal. Registros sem Cliente não são comparados.

Prévia paginada dos planos preventivos mostra IDs pertencentes ao Cliente, situação e quantidade de ocorrências, sem converter plano, inferir vínculo ou alterar histórico. Alvos de outro Cliente não são expostos. O gate e RPCs permanecem fechados; verificação global integral, análise detalhada autorizada, mudanças em lote, rollback e homologação continuam pendentes.
