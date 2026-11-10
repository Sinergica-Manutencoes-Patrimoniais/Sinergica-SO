---
name: "docs-adr-1291-recibo-copia-rotina-md"
description: "Documento Sinérgica SO: ADR 1291 — Consulta de recibo de cópia de Rotina"
alwaysApply: false
---

# ADR 1291 — Consulta de recibo de cópia de Rotina

## Contexto

A cópia entre Planos registra pedido e resultado imutáveis. Se a resposta se perder, o operador precisa verificar o resultado sem iniciar outra cópia.

## Decisão

Adicionar consulta autenticada restrita ao ator original, com capacidades atuais nos Clientes de origem e destino, gate de cópia e comparação do pedido integral. Retornar somente o recibo já registrado. Sem escrita, publicação ou geração de execução. Recibo indisponível não comprova falha, inclusive durante commit.

## Implantação e retorno

Migration aditiva e flag de interface desligada. Validar payload canônico, acesso entre Clientes, transferência de Plano, revogação, concorrência, RLS/FORCE, privacidade e revisão adversarial antes de habilitar. Retorno desliga flag; recibos e histórico permanecem.
