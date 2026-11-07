---
name: "docs-adr-1156-transferencia-os-origem-material-md"
description: "Documento Sinérgica SO: ADR-1156 — Origem de material na transferência de OS enviada"
alwaysApply: false
---

# ADR-1156 — Origem de material na transferência de OS enviada

Status: proposta local, não aplicada nem homologada.

A transferência local de OS enviada pode referenciar uma exceção de material da mesma OS e Cliente. A entrada reaproveita o comando transacional de transferência conferida e grava a origem na mesma transação; mantém o identificador da tarefa Auvo e cria somente intenção pendente, sem executar reprogramação remota. A associação é histórica, não comprova que a exceção continue aberta.

Travas de composição precedem requestId, conforme comando existente. Lista e evento são obtidos sem espera para evitar inversão com escritores de materiais; falha reverte também a transferência. O gate de material permanece fechado. Validar identidade, replay entre protocolos, concorrência nas duas ordens, revogação, gatilhos, FORCE RLS, rollback e revisão adversarial antes de habilitar. Nenhum envio é autorizado.
