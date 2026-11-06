---
name: "docs-adr-1629-serializacao-autorizacao-rotinas-md"
description: "Documento Sinérgica SO: ADR 1629: serialização de autorização nas mutações de Rotina"
alwaysApply: false
---

# ADR 1629: serialização de autorização nas mutações de Rotina

Inclusão, edição e retirada de Rotina devem observar uma ordem transacional inequívoca em relação à revogação de concessões. As três fronteiras adquirem a trava compartilhada existente antes de autorização e replay e exigem READ COMMITTED. Uma alteração concorrente de autorização retorna 55P03; operações concluídas mantêm seus recibos e os gates existentes.
