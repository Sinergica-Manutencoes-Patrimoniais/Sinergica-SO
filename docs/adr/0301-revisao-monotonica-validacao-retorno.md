---
name: "docs-adr-0301-revisao-monotonica-validacao-retorno-md"
description: "Documento Sinérgica SO: ADR-0301 — Revisão monotônica de decisões de retorno"
alwaysApply: false
---

# ADR-0301 — Revisão monotônica de decisões de retorno

Status: proposta, não homologada.

Um comando preparado serializa o retorno e registra evento imutável com revisão monotônica, chamando o comando de validação existente na mesma transação. Há comparação entre o número de decisões antigas e eventos versionados: qualquer histórico não vinculado bloqueia novas decisões versionadas até reconciliação explícita, sem presumir ordem por timestamp. A consulta devolve histórico em ordem de revisão; decisões posteriores invalidam leituras anteriores.

Os controles de cobertura e vínculo continuam aplicáveis; esta decisão não prova evidência integral, não encerra OS nem Chamado. Gates próprio e de validação e EXECUTE permanecem fechados até testes e revisão adversarial.
