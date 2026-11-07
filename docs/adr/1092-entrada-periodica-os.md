---
name: "docs-adr-1092-entrada-periodica-os-md"
description: "Documento Sinérgica SO: ADR-1092 — Entrada de serviço para tick periódico de OS"
alwaysApply: false
---

# ADR-1092 — Entrada de serviço para tick periódico de OS

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar entrada HTTP interna, protegida por credencial de serviço e flag desligada, que chama uma página do coordenador periódico de OS e valida o recibo. Nenhum parâmetro externo escolhe Cliente ou objeto; a função não chama Auvo. Não criar cron, segredos ou deploy automaticamente.

## Limites

Timeout não prova rollback; o coordenador transacional deverá ser novamente consultado pelo próximo tick. Testar autenticação, concorrência, falhas, comportamento do runtime e recuperação antes da ativação. Confirmar fontes, observabilidade e revisão adversarial antes de configurar agendamento real.
