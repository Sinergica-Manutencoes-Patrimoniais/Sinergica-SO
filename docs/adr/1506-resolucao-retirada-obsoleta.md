---
name: "docs-adr-1506-resolucao-retirada-obsoleta-md"
description: "Documento Sinérgica SO: ADR-1506 — Mostrar retirada obsoleta na revisão"
alwaysApply: false
---

# ADR-1506 — Mostrar retirada obsoleta na revisão

## Contexto
Uma resolução de retirada é imutável e idempotente, mas a edição posterior do rascunho pode restaurar a mesma Rotina e alvo. A verificação da ADR-1503 volta a exigir reconciliação; a consulta anterior ainda reportava a resolução histórica como vigente.

## Decisão
Criar consulta versionada compatível que distingue resolução vigente, ausente e obsoleta. A resposta obsoleta informa que a retirada histórica existe, mas não resolve o impacto atual. Na tela, impedir nova tentativa com a mesma decisão e encaminhar o PCM a registrar nova decisão de impacto. A consulta anterior permanece disponível para consumidores legados; não fornece a distinção nova e não deve ser usada para liberar aprovação.

## Consequências
O recibo de uma repetição idêntica continua histórico e idempotente. Nenhuma ocorrência, OS ou tarefa é alterada. A correção não define como reconciliar nova âncora/data e não libera a guarda 1045. A implantação deve coordenar migration e tela; permanecem pendentes prova de fontes, concorrência e revisão adversarial.
