---
name: "docs-adr-1007-consulta-reservas-equipment-md"
description: "Documento Sinérgica SO: ADR-1007 — Consulta de reservas Equipment pendentes"
alwaysApply: false
---

# ADR-1007 — Consulta de reservas Equipment pendentes

Status: preparação privada, não homologada.

Preparar consulta paginada, por Cliente e Componente autorizado, de reservas duráveis de Equipment e estado local da outbox. A consulta não apresenta payload ou credenciais e não interpreta o estado local como prova de efeito remoto; não libera reserva, altera fila ou reenvia dados. A ausência de reservas não comprova ausência de envios anteriores.

Leitura exige identidade, capacidade cadastral atual, trava de autorização e gate próprio, com função privada. Paginação não é snapshot. Validar Cliente em ambas as pontas, privacidade, RLS/FORCE, concorrência, revogação, índices e revisão adversarial. A reconciliação e liberação segura continuam pendentes.
