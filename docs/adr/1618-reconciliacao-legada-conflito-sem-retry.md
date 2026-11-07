---
name: "docs-adr-1618-reconciliacao-legada-conflito-sem-retry-md"
description: "Documento Sinérgica SO: ADR-1618: fotografia divergente na reconciliação legada"
alwaysApply: false
---

# ADR-1618: fotografia divergente na reconciliação legada

Fotografia obsoleta na declaração de reconciliação é rejeição definitiva, não serialização transitória. O PostgREST de ensaio repete `40001`, atrasando a resposta.

A guarda específica passa a retornar `P0010` com `fotografia_obsoleta`. Autorização, travas, verificação das fontes, replay e demais erros permanecem iguais. A interface libera nova conferência apenas na primeira resposta definitiva; pedidos anteriores e respostas incertas permanecem preservados.

Consumidores externos devem reconhecer o novo par código e mensagem. Não há ativação, deploy ou comunicação externa nesta alteração.
