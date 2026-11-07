---
name: "docs-adr-0999-consulta-politica-equipment-md"
description: "Documento Sinérgica SO: ADR-0999 — Consulta de política Equipment"
alwaysApply: false
---

# ADR-0999 — Consulta de política Equipment

Status: preparação privada, não homologada.

Preparar consulta de categorias ativas e política global em páginas por UUID, sem deduzir configuração para categoria não configurada. Somente superadmin ativo e autenticado, sob trava de autorização e gate da política, poderá consultar; função nasce privada. A tela deve indicar que política é global, requer motivo e revisão e não muda a fila atual ou vínculos externos.

Paginação não é fotografia de todas as categorias. Verificar proteção e privacidade, revogação, alterações concorrentes, FORCE RLS do proprietário, índices e recuperação de tentativa antes de habilitar. O vínculo da categoria textual legada ao ID e a aplicação efetiva no dispatcher continuam pendentes.
