---
name: "docs-adr-1169-ciencia-servico-t24-md"
description: "Documento Sinérgica SO: ADR-1169 — Confirmação e ciência na revalidação T−24"
alwaysApply: false
---

# ADR-1169 — Confirmação e ciência na revalidação T−24

Status: proposta local, não aplicada nem homologada.

Preparar consulta privada para serviço que compara confirmação PCM da revisão da Visita com política efetiva atual, respeitando precedência Visita, contrato, Cliente e padrão. Quando a política exige ciência, conferir publicação e confirmação correspondente à mesma revisão. Escopos de política são bloqueados de modo não bloqueante; divergência, ausência ou contenção não autorizam avanço.

O resultado não substitui autorização do ator, fonte do alvo, conteúdo, contrato externo ou exclusividade do executor. A função não inicia efeito nem recebe EXECUTE. Validar precedência, escopos, publicação/revogação concorrente, RLS/FORCE, compatibilidade das travas e revisão adversarial antes de integrar.
