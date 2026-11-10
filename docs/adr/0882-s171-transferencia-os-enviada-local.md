---
name: "docs-adr-0882-s171-transferencia-os-enviada-local-md"
description: "Documento Sinérgica SO: ADR-0882 — Transferência local de OS enviada com intenção"
alwaysApply: false
---

# ADR-0882 — Transferência local de OS enviada com intenção

Data: 2026-10-30 · Status: proposta, não implantada

## Contexto

A S171 exige trocar o vínculo vigente de uma OS entre Visitas e preservar a tarefa Auvo. Os comandos 0350/0433 recusam OS com efeito remoto, enquanto 0435 registra intenção sem transferir vínculo. Nenhum deles cumpre a jornada completa.

## Decisão

Preparar comando autenticado e transacional para OS com tarefa Auvo identificada: travar autorização e gates de intenção e transferência, serializar composição e requestId, travar Visitas em ordem, vínculo e OS, verificar capacidades, Cliente, estados e revisões, encerrar vínculo anterior e criar outro com mesma OS, e registrar a intenção pendente com identidade original e janela de destino. Atualizar revisões e invalidar confirmação das Visitas confirmadas. Auditoria, resultado idempotente e dados mudam juntos; qualquer erro reverte tudo. A tarefa remota não é criada, apagada ou alterada, e a intenção não afirma sincronização.

Os gates existentes seguem fechados. A aplicação não deve liberar operação até comprovar corrida com todos os escritores de Visita, vínculos, estado da OS e sincronização Auvo, capacidade/alertas e verificação de identidade externa, ACL/HTTP oficiais, rollout e revisão adversarial. Intenções antigas permanecem íntegras; conflitos de requestId ou revisão são explícitos. Não executar integração real ou deploy nesta etapa.
