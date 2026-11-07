---
name: "docs-adr-1355-decisao-fila-preventiva-md"
description: "Documento Sinérgica SO: ADR 1355 — Decisão preliminar a partir da fila preventiva"
alwaysApply: false
---

# ADR 1355 — Decisão preliminar a partir da fila preventiva

## Contexto

A fila local mostra ciclos aguardando ou em verificação, mas o PCM precisa voltar à prévia para consultar ou registrar a decisão preliminar por ciclo.

## Decisão

Adicionar projeção versionada de leitura com versão de origem e índice do ciclo, reutilizando a lista autorizada da fila. A interface pode abrir a decisão preliminar existente na identidade de origem, sem converter automaticamente estado da fila ou afirmar execução. Revisão é obtida da lista de Planos; o comando proprietário revalida no servidor. Em inconsistência de identidade, a decisão permanece indisponível.

## Consequências

A projeção não substitui fotografia aprovada nem prova vigência, execução ou cobertura da fila. Exige validação de autorização, RLS/FORCE, consistência histórica, concorrência, paginação, invalidação e revisão adversarial. Gates existentes continuam fechados.
