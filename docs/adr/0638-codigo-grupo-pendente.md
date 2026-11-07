---
name: "docs-adr-0638-codigo-grupo-pendente-md"
description: "Documento Sinérgica SO: ADR-0638 — Código informado de Grupo permanece pendente"
alwaysApply: false
---

# ADR-0638 — Código informado de Grupo permanece pendente

Status: proposta; gate fechado, não homologada.

O PCM pode registrar decisão expressa de manter o código informado de uma linha de Grupo pendente, com retrato, revisão, motivo e histórico imutável. O valor original permanece no staging; não é alias, não é código oficial e não foi validado como único. A decisão não libera criação ou incorporação de Grupo com código, porque o comando canônico ainda não possui representação segura para ele.

Consulta limitada ao Cliente autorizado; RPCs e gate fechados. Interface, definição de representação oficial, revisão e testes permanecem pendentes. Não alterar códigos legados ou inventar namespace.
