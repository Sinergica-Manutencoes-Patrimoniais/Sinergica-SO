---
name: "docs-adr-0283-hierarquia-grupos-sistema-md"
description: "Documento Sinérgica SO: ADR-0283 — Consulta paginada de Grupos por Sistema"
alwaysApply: false
---

# ADR-0283 — Consulta paginada de Grupos por Sistema

Prepara-se consulta de leitura por Cliente com paginação por identificador de Grupo, preservando resultados mesmo se Local, Área ou Sistema estiver indisponível. A projeção identifica vínculos como válidos, ausentes ou indisponíveis sem expor dados de outro Cliente. Não se assume que ausência significa vínculo inexistente; nenhum dado é alterado.

Gate e execução permanecem fechados. Testes de autorização, paginação e hierarquia são necessários antes da ativação.
