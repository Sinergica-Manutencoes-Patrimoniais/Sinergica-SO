---
name: "docs-adr-0125-transferencia-os-entre-visitas-md"
description: "Documento Sinérgica SO: ADR-0125 — Transferência transacional de OS entre Visitas"
alwaysApply: false
---

# ADR-0125 — Transferência transacional de OS entre Visitas

**Estado:** proposta não aplicada, não testada e não habilitada. Complementa ADR-0060 e ADR-0074.

## Decisão

Preparar transferência por comando único: bloquear ambas Visitas em ordem de UUID, validar Cliente, revisão e permissão atuais, fechar vínculo anterior com motivo e criar outro na Visita de destino em uma transação. Preservar OS, tarefa remota, dados executados e histórico; não chamar Auvo. A primeira versão recusa Visitas confirmadas ou enviadas, pois invalidação de confirmação e intenção de atualização remota não estão integradas. Gate fechado e EXECUTE revogado.

## Limites

Não completa AC-4 para OS enviadas. Ordem de locks precisa compatibilidade com todos comandos legados, confirmação e revogação; proteção de permissão exige serialização. Não há intenção de E01-S168 nem integração com calendário, seleção e controle de transações no frontend. Avaliar histórico, colisão de sequência, dados antigos, RLS, corrida de criação/cancelamento e retry após commit em CI/db-tests e revisão adversarial antes de aplicação ou ativação. Não apagar vínculos nem renumerar OS.
