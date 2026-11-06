---
name: "docs-adr-1375-rastreio-candidato-servico-md"
description: "Documento Sinérgica SO: ADR-1375 — Rastreio do candidato de serviço"
alwaysApply: false
---

# ADR-1375 — Rastreio do candidato de serviço

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Preparar leitura autorizada que liga um candidato à declaração, OS, proposta, versão, linha, fato, fotografia e revisão PCM de origem, sem expor conteúdo da evidência. A consulta exige Cliente e capacidades financeira e de validação, gate de leitura e trava de autorização. Falhas de integridade são erros, não dados parciais. A fila apresenta o rastreio sob demanda.

## Limites

Rastreio não comprova execução física, exclusividade, disponibilidade para conferência ou direito de cobrança. Validar ACL/RLS/FORCE, Cliente, divergências históricas, gates, concorrência e revisão adversarial antes de habilitar.
