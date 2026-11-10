---
name: "docs-adr-0716-mediacao-leituras-faturaveis-md"
description: "Documento Sinérgica SO: ADR-0716 — Mediação de leituras financeiras"
alwaysApply: false
---

# ADR-0716 — Mediação de leituras financeiras

Status: preparado, não aplicado nem homologado.

As consultas de saldo e de lançamentos são mediadas por funções autenticadas e gate próprio inicialmente fechado. As funções internas permanecem revogadas; a mediação exige usuário atual, capacidade `faturavel.efetivar`, Cliente explícito e item pertencente ao Cliente. A lista mantém paginação e projeção da função existente; saldo usa 0939, que inclui reservas e seus próprios gates.

Não conceder escrita ou acesso direto às tabelas. Antes de habilitar: validar ownership, permissões de schema e funções, RLS, revogação, concorrência e contrato de saldo; gate de leitura não substitui protocolo transacional ainda pendente nas escritas. Nenhum faturamento é realizado.
