---
name: "docs-adr-0951-consulta-decisoes-onda-md"
description: "Documento Sinérgica SO: ADR-0951 — Consulta privada de decisões por onda"
alwaysApply: false
---

# ADR-0951 — Consulta privada de decisões por onda

Status: preparação local, sem homologação.

Preparar consulta paginada de decisões declaradas, restrita a Cliente/onda e autorização atual, com gates de decisão e evidência fechados por padrão. Retornar ator, instante, versão/ambiente, revisão das evidências, referências e cenários que fundamentaram cada decisão; não devolver payload de tentativa. Informar a revisão atual da onda para identificar decisão baseada em fotografia anterior. Resultado é histórico de declarações, nunca liberação operacional.

Cursor por data/ID não garante fotografia transacional entre páginas ou captura de commits tardios. Interface deve indicar essa limitação e bloquear apresentação durante reconsulta/erro. Revisar paginação concorrente, auditoria de leitura, privacidade das referências, fontes de autorização e FORCE RLS do proprietário antes de conceder EXECUTE ou habilitar gate. Não usar consulta como prova de aceite global, CI ou autenticação dos artefatos.
