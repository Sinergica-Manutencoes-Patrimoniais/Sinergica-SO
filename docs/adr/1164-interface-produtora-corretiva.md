---
name: "docs-adr-1164-interface-produtora-corretiva-md"
description: "Documento Sinérgica SO: ADR-1164 — Preparação corretiva na Visita"
alwaysApply: false
---

# ADR-1164 — Preparação corretiva na Visita

Status: proposta local, não aplicada nem homologada.

Conceder à interface autenticada o comando de candidata corretiva sob gates fechados e flag própria de interface. O pedido e recibo registram o protocolo, impedindo que repetição ou recuperação de corretiva seja tratada como preventiva. A consulta do recibo deve verificar protocolo e identidade antes de limpar tentativa. O comando prepara fila e livro, sem enviar.

Validar gates, política Equipment, fontes, autorização, migração de tentativas antigas, concorrência, recuperação, contrato externo e revisão adversarial antes de ativar. A concessão não libera os gates nem comprova integração Auvo.
