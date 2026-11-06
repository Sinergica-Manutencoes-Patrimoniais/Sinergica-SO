---
name: "docs-adr-0258-situacao-os-portal-md"
description: "Documento Sinérgica SO: ADR-0258 — Situação pública da OS e validação"
alwaysApply: false
---

# ADR-0258 — Situação pública da OS e validação

Status: proposta; gate e funções sem liberação.

A situação pública distingue o estado operacional legado do registro específico de validação PCM. `finalizado` não significa validação PCM; eventos Auvo não são aprovação. A projeção apenas informa existência de uma aprovação em retorno preparado, sem declarar que toda a OS foi validada, pois múltiplos retornos e revisões não têm consolidação canônica comprovada. Sem aprovação comprovada ou com histórico ausente, a interface não infere aprovação. Não expõe observações, respostas, autores ou custos. Requer revisão dos modelos de validação, autorização, concorrência e testes antes da ativação.
