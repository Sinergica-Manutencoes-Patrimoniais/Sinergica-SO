---
name: "docs-adr-0336-previa-cobertura-por-pergunta-md"
description: "Documento Sinérgica SO: ADR-0336 — Prévia de cobertura por pergunta histórica"
alwaysApply: false
---

# ADR-0336 — Prévia de cobertura por pergunta histórica

Status: proposta, não homologada.

Consulta parte de cada pergunta do snapshot aprovado ligado à OS, inclusive perguntas sem resposta, e apresenta resultado e última decisão humana da resposta, com revisão dos uploads. O snapshot de questionário atual aceita perguntas JSON sem contrato tipado de obrigatoriedade; campo booleano `obrigatorio`, quando presente, é apresentado como dado bruto declarado, não como regra validada. Na ausência ou tipo incompatível, obrigatoriedade permanece indeterminada. Não se presume foto obrigatória nem opcional sem contrato aplicável.

Aceite humano e existência de upload não autenticam conteúdo, não substituem revisão normativa e não aprovam OS. A consulta é informativa e não altera cobertura ou execução. Gates e EXECUTE fechados; exige contratos tipados, testes e revisão antes de ativação.
