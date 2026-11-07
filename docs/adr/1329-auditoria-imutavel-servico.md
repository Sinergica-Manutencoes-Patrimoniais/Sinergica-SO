---
name: "docs-adr-1329-auditoria-imutavel-servico-md"
description: "Documento Sinérgica SO: ADR-1329 — Imutabilidade explícita de auditoria"
alwaysApply: false
---

# ADR-1329 — Imutabilidade explícita de auditoria

Status: preparado; não aplicado ou homologado.

`audit.events` é histórico append-only. Além das políticas existentes, revogar
UPDATE, DELETE e TRUNCATE dos papéis de aplicação e instalar guarda de banco
para essas operações, incluindo execução com `service_role`. Inserção e leitura
já autorizadas permanecem inalteradas. A guarda não impede administrador do
banco de desativar triggers ou alterar o esquema; isso exige controles externos.

A transição precisa de inventário de retenção e consumidores, teste com os
papéis reais e revisão adversarial antes de qualquer implantação. Rollback
coordenado remove a guarda e restaura somente os privilégios previamente
documentados; nunca apaga eventos nem concede privilégios adicionais por
suposição. Operações de retenção exigem procedimento próprio autorizado.
