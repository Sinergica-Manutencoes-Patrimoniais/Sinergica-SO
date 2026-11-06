---
name: "docs-adr-1592-serializacao-leitura-excecao-visita-md"
description: "Documento Sinérgica SO: ADR-1592 — Serializar leitura de exceção com revogação"
alwaysApply: false
---

# ADR-1592 — Serializar leitura de exceção com revogação

A consulta de exceção validava permissões no início e no fim, mas podia retornar histórico durante uma revogação ainda não confirmada. Em clone, a leitura conseguiu acessar o histórico enquanto outra transação mantinha a revogação aberta.

A consulta passa a exigir READ COMMITTED e a tomar a trava compartilhada já usada pelas alterações de autorização. Se uma revogação estiver em andamento, a leitura falha para retry; se a consulta começar primeiro, a revogação não ultrapassa sua transação. Permissões atuais e escopo de Cliente continuam verificados; escrita, histórico e gates não mudam.
