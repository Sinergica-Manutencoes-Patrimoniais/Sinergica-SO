---
name: "docs-adr-0634-quantidade-declarada-grupo-md"
description: "Documento Sinérgica SO: ADR-0634 — Quantidade declarada em ocorrência de Grupo"
alwaysApply: false
---

# ADR-0634 — Quantidade declarada em ocorrência de Grupo

PCM informa quantidade inteira de zero até a quantidade histórica da ocorrência, vinculada à OS e ao atestado declarados, com revisão monotônica, motivo e auditoria. Quantidades trafegam como texto para evitar perda de precisão. Cada revisão substitui a declaração anterior; não se somam revisões nem se presume cobertura completa.

O registro não comprova execução nem encerra ocorrência. A identidade coletiva não identifica unidades individuais e o modelo atual permite somente uma OS declarada por ocorrência; consolidação de múltiplas visitas/OS requer contrato próprio. Gate e permissões fechados; concorrência, testes e homologação pendentes.
