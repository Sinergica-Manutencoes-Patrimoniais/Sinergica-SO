---
name: "docs-adr-1511-comparacao-impacto-por-identidade-md"
description: "Documento Sinérgica SO: ADR-1511 — Comparação da Rotina ao decidir impacto"
alwaysApply: false
---

# ADR-1511 — Comparação da Rotina ao decidir impacto

## Contexto
A decisão de impacto apresentava ocorrência por ID e data sem mostrar lado a lado a Rotina da versão anterior e a do rascunho. Uma ocorrência pode ter sido criada em versão mais antiga e reutilizada pela versão anterior; correlacionar apenas pelo ID físico da Rotina é incorreto.

## Decisão
Consultar a ocorrência autorizada e comprovar que pertence à versão anterior ou foi usada por ela ou possui selo de continuidade nessa versão aprovada; relacionar as duas versões exclusivamente por identidade lógica. Apresentar alvo, regra e âncora da ocorrência e da Rotina anterior e do rascunho, com ausência explícita quando a Rotina foi retirada. Se a identidade anterior for ausente ou ambígua, negar a comparação, sem inferência. A interface exige dados disponíveis e confirmação relacionada à comparação exibida antes de enviar a decisão.

## Consequências
A comparação é parcial: não prova fontes externas, OS, conteúdo do questionário nem aprovação. A decisão continua fotografando efeitos no servidor; mudanças depois da consulta não são cobertas por token de comparação nesta etapa. A guarda 1045 e os demais gates permanecem inalterados, assim como histórico, ocorrências e OS. Validar autorização, reuso entre versões e concorrência antes da ativação.
