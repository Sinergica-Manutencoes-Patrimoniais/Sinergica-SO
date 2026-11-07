---
name: "docs-adr-0541-janela-fuso-snapshot-md"
description: "Documento Sinérgica SO: ADR-0541 — Janela de geração no fuso congelado"
alwaysApply: false
---

# ADR-0541 — Janela de geração no fuso congelado

Status: preparado, gates desligados, não aplicado nem homologado. As funções preparadas 0337 e 0734 usam a data civil do fuso IANA congelado na versão aprovada para a janela inclusiva de hoje até +30 dias. Snapshot antigo sem fuso explícito, vigência incompatível ou fuso inválido falha fechado; não presume valor nem gera retroativos. Âncora e identidade permanecem inalteradas.

Substituições aditivas preservam as proteções 0755 e 0736; devem ser comparadas às funções efetivamente instaladas. A declaração da fonte não comprova vínculo contratual. São necessários testes de fuso/DST e concorrência, política para versões antigas e revisão adversarial antes de qualquer gate.
