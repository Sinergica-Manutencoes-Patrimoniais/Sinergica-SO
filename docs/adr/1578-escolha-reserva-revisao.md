---
name: "docs-adr-1578-escolha-reserva-revisao-md"
description: "Documento Sinérgica SO: ADR 1578 — Escolha de ciclo futuro em revisão"
alwaysApply: false
---

# ADR 1578 — Escolha de ciclo futuro em revisão

## Contexto
A conciliação precisa ocorrer antes da aprovação, mas uma escolha do rascunho não pode modificar obrigações em vigor.

## Decisão
Escolhas explícitas são registradas com fotografia e revisão do rascunho. A aprovação revalida e sela somente escolhas atuais na mesma transação do token; a selagem não altera OS, fila ou tarefas. Os efeitos operacionais exigem vigência da versão aprovada e revalidação das fontes.

## Limites
A guarda 1045 permanece. O módulo exige revisão adversarial e validação integrada antes de homologação. A escolha por ciclo não cobre automaticamente outros ciclos ou Planos.
