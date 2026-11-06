---
name: "docs-adr-0209-intencao-reconciliacao-os-enviada-md"
description: "Documento Sinérgica SO: ADR-0209 — Intenção de reconciliação para OS enviada"
alwaysApply: false
---

# ADR-0209 — Intenção de reconciliação para OS enviada

Status: proposta, não homologada.

Uma OS com tarefa Auvo vinculada pode receber intenção interna de transferência entre Visitas do mesmo Cliente. Comando registra identidade existente, revisões e janelas observadas, vínculo anterior, motivo e ator, sem alterar vínculo, OS, Visitas ou tarefa remota. Uma intenção pendente por OS impede pedidos paralelos; requestId é idempotente e decisões ficam auditadas. A tabela e comando permanecem privados e sob gate fechado.

Isto não reprograma a OS nem comprova efeito remoto; não existe dispatcher, retry ou reconciliação remota. São necessários confirmação de destino, versionamento/fencing, idempotência remota, retorno tardio, resolução das intenções, testes e revisão adversarial antes de uso. Não cancelar tarefa, não gerar nova tarefa ou consultar Auvo por este comando.
