---
name: "docs-adr-1328-consulta-reservas-envio-legado-md"
description: "Documento Sinérgica SO: ADR-1328 — Consulta de reservas de envio legado"
alwaysApply: false
---

# ADR-1328 — Consulta de reservas de envio legado

Status: preparado, dependente da ADR-1327; gates fechados.

Permitir ao usuário com capacidade atual de reconciliação consultar reservas
pendentes do próprio Cliente em páginas ordenadas, com identificadores da OS e
horário da reserva. O servidor confere ator, Cliente e autorização; a consulta
não retorna payload ou credenciais e não altera reservas nem aciona o Auvo.
Resultados podem mudar entre páginas e não provam envio, falha ou parada.

Antes de habilitar, validar privacidade, RLS/FORCE, revogação, paginação,
concorrência e revisão adversarial. Rollback remove somente acesso à consulta e
sua apresentação, preservando os registros e o bloqueio de reservas pendentes.
