---
name: "docs-adr-1025-feriado-materializacao-visita-legado-md"
description: "Documento Sinérgica SO: ADR-1025 — Feriado na materialização de Visita legada"
alwaysApply: false
---

# ADR-1025 — Feriado na materialização de Visita legada

Status: preparação fechada, não homologada.

Na inserção do recibo de materialização legada por Visita, preparar revalidação de feriado ativo sob a trava compartilhada do Cliente, usando a ocorrência preparada e a origem contratual. Se houver declaração aplicável, a transação deve falhar integralmente. A guarda não altera datas nem remove registros e não deve impedir apenas vincular uma ocorrência histórica já existente para reconciliação.

A revalidação ocorre na transação da materialização e não cobre caminhos que ignorem o recibo, efeitos remotos fora da transação ou declarações posteriores. Ausência de feriado declarado não prova dia útil. Gate de coordenação permanece fechado; verificar rollback de todas as escritas, locks, replay, integrações legadas e revisão adversarial antes de habilitar.
