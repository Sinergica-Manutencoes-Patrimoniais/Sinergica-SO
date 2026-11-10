---
name: "docs-adr-1608-conflitos-fila-grupo-sem-retry-md"
description: "Documento Sinérgica SO: ADR-1608: conflitos definitivos na fila de Grupo"
alwaysApply: false
---

# ADR-1608: conflitos definitivos na fila de Grupo

Uma fotografia divergente na declaração de Grupo ou uma revisão divergente na reabertura são rejeições definitivas, não serializações transitórias. O PostgREST de ensaio repete SQLSTATE `40001`, atrasando a resposta.

As guardas específicas passam a retornar `P0010` para fotografia alterada e `P0012` para revisão de fila indisponível. As decisões preservam autorização, locks, replay e demais erros. A interface de reabertura reconhece o conflito apenas na primeira tentativa; declaração conserva tentativas em caso de dúvida.

Clientes externos que tratem apenas `40001` devem reconhecer os novos códigos com suas mensagens. Não há ativação nem chamada externa nesta alteração.
