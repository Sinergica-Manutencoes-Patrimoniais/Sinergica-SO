---
name: "docs-adr-1160-recibo-produtor-t24-md"
description: "Documento Sinérgica SO: ADR-1160 — Recuperação do recibo da candidata T−24"
alwaysApply: false
---

# ADR-1160 — Recuperação do recibo da candidata T−24

Status: proposta local, não aplicada nem homologada.

Permitir ao mesmo ator consultar recibo exato de uma tentativa de produção preventiva, com autorização atual de Visita e identificação integral de Cliente, Visita, OS, revisão e requestId. A consulta não repete o comando e não altera fila, candidata ou tarefa externa. A ausência do recibo não comprova que uma tarefa Auvo não exista e não autoriza outro envio. Exigir gate fechado por padrão e falhar sem revelar registros de outros atores ou Clientes.

Validar permissão/revogação, bloqueio de identidade, concorrência e privacidade, sessão, estado de autorização do gate, FORCE RLS e revisão adversarial antes de ativar. Intenções locais antigas continuam exigindo revalidação separada.
