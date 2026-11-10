---
name: "docs-adr-0679-cobertura-retorno-grupo-md"
description: "Documento Sinérgica SO: ADR-0679 — Cobertura histórica de retorno de Grupo"
alwaysApply: false
---

# ADR-0679 — Cobertura histórica de retorno de Grupo

A guarda de cobertura de retorno passa a localizar a versão aprovada pela associação declarada da OS à ocorrência de Grupo, verificando Cliente, Plano, Rotina, alvo e snapshot. As verificações existentes de perguntas, respostas e opcionais permanecem; a associação não comprova execução, autenticidade ou equivalência.

A barreira 0903 mantém bloqueadas as inserções de retorno, decisão, Pendência e finalização por Grupo; nenhum gate é habilitado. Concorrência, cobertura de todos os consumidores, testes e revisão adversarial permanecem necessários.
