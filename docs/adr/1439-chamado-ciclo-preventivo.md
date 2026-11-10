---
name: "docs-adr-1439-chamado-ciclo-preventivo-md"
description: "Documento Sinérgica SO: ADR 1439 — Chamado de ciclo preventivo por calendário"
alwaysApply: false
---

# ADR 1439 — Chamado de ciclo preventivo por calendário

Um ciclo canônico de calendário pode ter um único Chamado associado, mesmo quando representado em revisões diferentes do Plano. O comando registra pedido idempotente, confere Cliente e fotografia aprovada, recusa ciclo cancelado e exige reconciliação se já houver OS vinculada à ocorrência. Não cria OS nem tarefa externa. O vínculo e o histórico são preservados; o gate inicia fechado.

O caminho por Visita e a reconciliação de OS preexistentes ainda precisam de implementação. Validar concorrência, escritores legados, estado do ciclo, autorização, restrições de Chamados e revisão adversarial antes de habilitar.
