---
name: "docs-adr-1631-serializacao-autorizacao-revisao-md"
description: "Documento Sinérgica SO: ADR 1631: serialização da autorização em transições de revisão"
alwaysApply: false
---

# ADR 1631: serialização da autorização em transições de revisão

Iniciar, submeter e devolver revisão exigem autorização vigente. As transações dessas operações adquirem a trava compartilhada usada pela revogação antes de consultar concessões ou replay e exigem READ COMMITTED. Concorrência retorna 55P03 sem alterar o Plano; recibos e gates existentes permanecem intactos.
