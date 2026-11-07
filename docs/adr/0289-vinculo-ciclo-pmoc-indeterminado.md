---
name: "docs-adr-0289-vinculo-ciclo-pmoc-indeterminado-md"
description: "Documento Sinérgica SO: ADR-0289 — Pré-condições de vínculo de ciclo com PMOC"
alwaysApply: false
---

# ADR-0289 — Pré-condições de vínculo de ciclo com PMOC

Status: proposta, não homologada.

`pmoc_schedules` aponta imóvel e contrato, mas o schema encontrado não vincula seu agendamento ao Sistema, Componente ou Grupo da Rotina SSO. A igualdade de Cliente e data não comprova alvo nem equivalência funcional. Portanto, a consulta valida somente pré-condições comprováveis e retorna vínculo indisponível por falta de evidência de alvo; não cria vínculo, não deduplica nem modifica PMOC. Estabelecer um vínculo exige fonte verificável que una agendamento, contrato e alvo, mais revisão das regras operacionais; uma declaração manual isolada não é prova dessa relação.

Gate de diagnóstico e EXECUTE ficam fechados; nenhuma OS é gerada ou cancelada. Revisão de segurança e testes são obrigatórios antes de uso.
