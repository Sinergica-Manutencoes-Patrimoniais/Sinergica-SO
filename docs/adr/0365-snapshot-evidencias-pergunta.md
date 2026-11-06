---
name: "docs-adr-0365-snapshot-evidencias-pergunta-md"
description: "Documento Sinérgica SO: ADR-0365 — Congelamento e avaliação do requisito de evidência"
alwaysApply: false
---

# ADR-0365 — Congelamento e avaliação do requisito de evidência

Status: proposta, não homologada.

Com gate próprio habilitado, a aprovação de versão congela declaração PCM de exigência de evidência para cada pergunta de questionário, verificando versão e conteúdo da fonte. Versões já aprovadas nunca são reescritas; snapshots sem contrato permanecem indeterminados. A avaliação percorre o snapshot e distingue exigência declarada, decisão PCM e ausência de evidência; não promove cobertura nem atribui autenticidade ou procedência Auvo. Evidência não é automaticamente exigida quando a resposta opcional está ausente.

O atual caminho de decisão PCM aceita upload privado, mas não é política completa para outros tipos de evidência. Conteúdo, autenticidade e aceitação operacional continuam pendentes. Gates e EXECUTE fechados, testes e revisão adversarial obrigatórios.
