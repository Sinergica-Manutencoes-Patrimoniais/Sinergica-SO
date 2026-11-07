---
name: "docs-adr-1617-conflitos-diagnostico-revisao-md"
description: "Documento Sinérgica SO: ADR 1617: revisão divergente em diagnósticos e pré-condição"
alwaysApply: false
---

# ADR 1617: revisão divergente em diagnósticos e pré-condição

Revisão divergente é um conflito conhecido e recebe P0011, evitando retentativas do transporte para um pedido que não poderá mudar o resultado. A autorização, replay de pré-condições e erros de serialização reais permanecem inalterados. A interface preserva qualquer pedido previamente incerto.
