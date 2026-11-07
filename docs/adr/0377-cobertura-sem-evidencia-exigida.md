---
name: "docs-adr-0377-cobertura-sem-evidencia-exigida-md"
description: "Documento Sinérgica SO: ADR-0377 — Conferência quando nenhuma evidência é exigida"
alwaysApply: false
---

# ADR-0377 — Conferência quando nenhuma evidência é exigida

Status: proposta, não homologada.

A conferência preparada pode registrar evidência geral nula somente quando a avaliação do snapshot congelado comprova zero requisitos indeterminados e zero exigências aplicáveis. A ausência de evidência não é tratada como prova nem como dispensa sem contrato. Exigências aplicáveis continuam no caminho conservador que requer referência declarada e validação PCM; não se infere autenticidade ou procedência.

Revisão de evidências zero passa a ser válida quando não há registros, mantendo verificação otimista. Mudanças de requisitos, snapshots ou dados obrigam nova conferência; aprovação e encerramento permanecem gated. Mudanças nas migrations preparadas 0530/0552/0580/0589/0598/0601 pressupõem que não foram aplicadas; em ambientes onde já existam, é obrigatória migration substitutiva com CREATE OR REPLACE antes de uso. Testes/revisão adversarial obrigatórios.
