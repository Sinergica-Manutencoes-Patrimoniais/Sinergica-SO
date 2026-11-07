---
name: "docs-adr-0296-decisao-humana-proposta-pmoc-md"
description: "Documento Sinérgica SO: ADR-0296 — Decisão humana sobre proposta PMOC"
alwaysApply: false
---

# ADR-0296 — Decisão humana sobre proposta PMOC

Status: proposta, não homologada.

Decisão de validação declarada pelo PCM ou rejeição é um evento imutável versionado por proposta, com responsável, motivo e referência explícita à evidência formal identificada pelo operador. A aplicação não lê nem verifica o documento referenciado; validação é declaração humana, não comprovação automática de equivalência. Novas decisões preservam o histórico, concorrência exige revisão esperada, e a versão do Plano usada na proposta deve permanecer atual. Agendamento e ciclo são novamente verificados em fonte disponível.

Nenhuma decisão, mesmo validada, ativa deduplicação nem altera PMOC, OS ou ciclos. Uma futura automação exige contrato de evidência verificável e decisão operacional separada. Gate específico e EXECUTE nascem fechados; testes e revisão adversarial antes da ativação.
