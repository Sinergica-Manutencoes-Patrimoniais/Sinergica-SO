---
name: "docs-adr-1076-seletor-interrupcao-cadeia-md"
description: "Documento Sinérgica SO: ADR-1076 — Seletor de OS para interrupção em cadeia"
alwaysApply: false
---

# ADR-1076 — Seletor de OS para interrupção em cadeia

Status: proposta local, não aplicada nem homologada.

## Decisão

No modo de interrupção do seletor de ciclo posterior, apresentar as OS do Chamado que tenham vínculo inequívoco com a parcela, incluindo continuações registradas e propostas executadas. Exigir que a fonte comum reconheça exatamente uma parcela e que ela corresponda ao ciclo. Conservar a paginação por OS, permissões e gates existentes; o modo de atribuição inicial permanece inalterado. Não escolher automaticamente a OS mais recente nem inferir qual foi interrompida.

## Limites

O operador ainda deve selecionar e declarar a OS correta. A listagem não comprova parada ou execução e não substitui conferência de todas as OS da cadeia. Testar autorização, isolamento, paginação, desempenho, concorrência, ambiguidades e fluxo completo de devolução no esquema real antes da ativação; ciclos legados permanecem fora desta consulta. Nenhum envio externo é autorizado.
