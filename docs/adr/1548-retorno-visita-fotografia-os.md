---
name: "docs-adr-1548-retorno-visita-fotografia-os-md"
description: "Documento Sinérgica SO: ADR-1548 — Retorno de Visita usa fotografia da OS"
alwaysApply: false
---

# ADR-1548 — Retorno de Visita usa fotografia da OS

Status: proposto, dependente de validação. Após ADR-1546, uma OS preventiva pode nascer de Chamado sem ocorrência legada e precisa preservar a versão efetiva no momento da criação. Classificação manual e cobertura de perguntas devem usar a fotografia imutável vinculada à própria OS; retornos anteriores sem fotografia mantêm o caminho legado. Uma fotografia divergente deve falhar fechada, nunca cair no caminho histórico. A barreira 1690 permanece ativa, assim como a guarda 1045. As leituras 0800 de prévia e paginação também usam a fotografia quando presente. Sem Auvo, deploy ou alteração das OS anteriores.
