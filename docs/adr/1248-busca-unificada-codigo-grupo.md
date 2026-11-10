---
name: "docs-adr-1248-busca-unificada-codigo-grupo-md"
description: "Documento Sinérgica SO: ADR-1248 — Busca conjunta de códigos públicos"
alwaysApply: false
---

# ADR-1248 — Busca conjunta de códigos públicos

**Status:** proposta local, não homologada. Complementa ADR-1247.

Preparar nova consulta separada, com gate fechado, que procura códigos atuais e históricos de Sistemas, Componentes e Grupos no Cliente autorizado. A comparação normaliza caixa e espaços externos para detectar colisões; múltiplas entidades retornam somente situação ambígua, sem escolher ou expor outra entidade. Pesquisa por código antigo de Grupo resolve o mesmo UUID e informa o código atual.

Não substitui a consulta legada até rollout coordenado; normalização difere do comportamento antigo. Revisar todos os escritores, revogação, concorrência e dados legados antes de abrir gate, conceder uso operacional ou declarar unicidade global. Sem alteração de códigos ou integração externa.
