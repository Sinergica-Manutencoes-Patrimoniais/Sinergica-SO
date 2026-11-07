---
name: "docs-adr-0569-lote-ciclos-legados-md"
description: "Documento Sinérgica SO: ADR-0569 — Lote de integração legada"
alwaysApply: false
---

# ADR-0569 — Lote de integração legada

Status: preparado, gates fechados, não aplicado nem homologado. Processa até 25 ciclos preparados do mesmo Plano e relação legada declarada, ordenados e em transação única, usando o comando 0764 e sua validação de Cliente, alvo, questionário, índice, data e fuso congelado. Retry é idempotente; qualquer falha reverte todo o lote. Não cria OS ou tarefa Auvo e não executa gerador legado em massa.

Relação declarada não comprova equivalência geral ou cobertura de Visitas/Grupos. Ordem de locks com 0718/0764, dados legados já vinculados, feriados, concorrência, integração de fila e revisão adversarial/testes bloqueiam ativação.
