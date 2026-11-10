---
name: "docs-adr-1412-recibo-evidencia-material-md"
description: "Documento Sinérgica SO: ADR-1412 — Recuperação do recibo de evidência de material"
alwaysApply: false
---

# ADR-1412 — Recuperação do recibo de evidência de material

## Decisão

Oferecer consulta da tentativa pelo mesmo ator, Cliente, lista, revisão e requestId. A leitura espera o comando conhecido pela mesma trava e devolve somente identificador da evidência vinculada. Ausência do recibo não prova que o upload terminou ou falhou; não autoriza criar outra tentativa.

## Limites

Migration e interface não aplicadas nem testadas. Validar concorrência com upload e vínculo, sessão e revogação, retenção de recibos, RLS/FORCE, caminhos alternativos e revisão adversarial. Não habilita upload nem comprova conteúdo ou origem da imagem.
