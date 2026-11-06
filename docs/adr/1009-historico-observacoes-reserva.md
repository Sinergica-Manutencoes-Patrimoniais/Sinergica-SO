---
name: "docs-adr-1009-historico-observacoes-reserva-md"
description: "Documento Sinérgica SO: ADR-1009 — Histórico de observações de reserva"
alwaysApply: false
---

# ADR-1009 — Histórico de observações de reserva

Status: preparação privada, não homologada.

Preparar leitura paginada das observações declaradas para uma reserva do Cliente autorizado. O resultado identifica ator, instante e texto sem afirmar prova de resultado remoto. Exigir sessão, capacidade atual, gate e vínculo da reserva; não apresentar observações de outro Cliente ou de reserva já desvinculada. Função privada, sem concessão.

Consulta e escrita são independentes e paginação não é snapshot. Validar privacidade e retenção dos textos, visibilidade após encerramento da reserva, concorrência com confirmação, revogação, RLS/FORCE e acessibilidade antes de habilitar. Este histórico não decide ou libera a reserva.
