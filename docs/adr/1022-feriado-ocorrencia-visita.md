---
name: "docs-adr-1022-feriado-ocorrencia-visita-md"
description: "Documento Sinérgica SO: ADR-1022 — Conferência de feriado na ocorrência por Visita"
alwaysApply: false
---

# ADR-1022 — Conferência de feriado na ocorrência por Visita

Status: preparação fechada, não homologada.

Preparar guarda de inserção da ocorrência por Visita que consulta Cliente do Plano e origem contratual, obtém trava compartilhada de feriados por Cliente e recusa a data de vencimento se houver declaração ativa aplicável. A trava permanece até o fim da transação e coordena com a escrita preparada no ADR-1021. A guarda não altera ocorrências existentes ou repetição já concluída.

Ausência de declaração não comprova dia útil e não autoriza materialização por si só; identidade do ciclo, vínculo da Visita, autorização, fontes oficiais e demais gates continuam obrigatórios. Não cobre geração de Visitas em outros caminhos nem reprogramações. Manter gates fechados; validar ordens de lock, concorrência, idempotência, RLS/FORCE, compatibilidade de dados e revisão adversarial antes de ativar.
