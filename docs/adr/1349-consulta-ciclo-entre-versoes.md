---
name: "docs-adr-1349-consulta-ciclo-entre-versoes-md"
description: "Documento Sinérgica SO: ADR 1349 — Consulta de ciclo reutilizado entre versões"
alwaysApply: false
---

# ADR 1349 — Consulta de ciclo reutilizado entre versões

## Contexto

Uma versão pode reutilizar ocorrência preparada em versão anterior para o mesmo ciclo canônico. Buscar somente pela versão da ocorrência original oculta esse vínculo e sugere incorretamente que não há preparação.

## Decisão

Adicionar consulta somente de leitura pela versão, Rotina e vencimento selecionados. Ela consulta usos de versão do ciclo canônico e confere Plano, Rotina lógica, alvo e vencimento da ocorrência original. Retorna a versão de origem e indica possível ambiguidade, sem criar dados. A consulta exige autenticação, permissão `plano.gerir`, Cliente e Plano correspondentes e gate de identidade ligado. Ausência não prova ausência de execução ou de vínculo ainda não identificado.

## Consequências

A interface mantém o resultado original da consulta por versão e usa este caminho somente como conferência adicional, sem sobrepor resultados divergentes. Revisar RLS/FORCE, autorização e concorrência, testar alterações e múltiplos vínculos antes da ativação. Não altera OS nem Auvo.
