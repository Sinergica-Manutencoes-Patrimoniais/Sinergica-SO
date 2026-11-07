---
name: "docs-adr-1553-consulta-escolha-alteracao-md"
description: "Documento Sinérgica SO: ADR-1553 — Consulta da escolha de alteração por ocorrência"
alwaysApply: false
---

# ADR-1553 — Consulta da escolha de alteração por ocorrência

Status: em desenvolvimento; não altera a guarda 1045 nem autoriza aprovação.

A leitura mediada informa se a última decisão da ocorrência corresponde a escolha de alteração e se a comparação permanece atual. Exige ator autenticado, permissões de Plano e, para Visita, de confirmação, além de Cliente, Plano, rascunho e revisões correspondentes. Não expõe fotografias nem dados de outras ocorrências. Em comparação obsoleta a interface orienta nova decisão; em ausência de escolha mantém o fluxo de retirada. Testar autorização, isolamento, obsolescência e mudanças concorrentes antes de habilitar.
