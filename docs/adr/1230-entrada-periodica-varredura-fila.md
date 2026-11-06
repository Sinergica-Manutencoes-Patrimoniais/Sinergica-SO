---
name: "docs-adr-1230-entrada-periodica-varredura-fila-md"
description: "Documento Sinérgica SO: ADR-1230 — Entrada periódica da varredura da fila"
alwaysApply: false
---

# ADR-1230 — Entrada periódica da varredura da fila

## Decisão

Preparar entrada interna para avançar uma página da varredura de Sistemas e Componentes, usando o executor transacional do ADR-1059. A entrada aceita apenas chamada autenticada de serviço e corpo vazio ou objeto vazio, limita leitura e tempo de espera, valida o recibo mínimo e não chama Auvo. Resultado incerto não é convertido em sucesso; o agendador deverá aguardar o próximo ciclo.

## Gates

Flag de ambiente e gates do banco permanecem desligados. Não registrar cron ou implantar nesta etapa. Validar autenticação e configuração do gateway, limites de corpo e timeout, execução concorrente, recibo, recuperação após timeout, RLS/FORCE, observabilidade e revisão adversarial antes de habilitar. A varredura cobre somente as fontes declaradas no executor e não comprova resultado remoto.
