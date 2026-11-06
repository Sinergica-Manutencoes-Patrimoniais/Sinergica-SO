---
name: "docs-adr-1279-executor-pagina-origem-campo-md"
description: "Documento Sinérgica SO: ADR-1279 — Fronteira interna do processamento de origem"
alwaysApply: false
---

# ADR-1279 — Fronteira interna do processamento de origem

Status: proposta local; não registrada nem homologada.

Preparar composição interna autenticada por papel de serviço para uma página limitada da inbox. O chamador escolhe a versão de contrato; o executor exige verificador independente injetado e usa cliente de banco de serviço, sem aceitar payload ou projeção do chamador. Consultas e escritas têm prazo de espera; timeout não comprova rollback. Não iniciar outro efeito para um item cujo resultado não foi confirmado.

As funções de banco permanecem protegidas por gates fechados; concessões destinam-se exclusivamente ao papel de serviço. Não registrar cron, endpoint público ou segredos. Antes de usar, prover e comprovar a verificação independente do contrato, proteção do consumidor legado, concorrência, idempotência, paginação e repetição, timeout/commit tardio, privacidade, RLS/FORCE, monitoramento e revisão adversarial.
