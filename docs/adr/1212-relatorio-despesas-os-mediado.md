---
name: "docs-adr-1212-relatorio-despesas-os-mediado-md"
description: "Documento Sinérgica SO: ADR-1212 — Relatório interno de despesas por OS"
alwaysApply: false
---

# ADR-1212 — Relatório interno de despesas por OS

## Decisão

Preparar entrada autenticada para a consulta interna de despesas rateadas por OS, mantendo o núcleo privado. A entrada exige ator atual, capacidade `despesa_visita.gerir`, gate e OS atualmente pertencente ao Cliente. Não publica custos nem gera cobrança.

O núcleo realiza mais de uma leitura sob READ COMMITTED; o resultado não é fotografia transacional e mudanças concorrentes em rateios e despesas podem produzir diferenças entre totais e contagens. A interface deve informar essa limitação, sem declarar integridade comprovada.

## Gates

Não ativar antes de validar permissões/RLS, identidade, concorrência, rateios, transferência, limites, consistência entre leituras e revisão adversarial. A consulta não inclui despesas sem rateio para a OS.
