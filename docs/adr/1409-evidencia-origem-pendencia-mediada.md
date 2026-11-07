---
name: "docs-adr-1409-evidencia-origem-pendencia-mediada-md"
description: "Documento Sinérgica SO: ADR-1409 — Leitura mediada de evidências de Pendência"
alwaysApply: false
---

# ADR-1409 — Leitura mediada de evidências de Pendência

## Decisão

Disponibilizar ao PCM entradas autenticadas para consultar os metadados das evidências e a última decisão humana, delegando a verificação da cadeia de origem às funções privadas existentes. A entrada exige ator, Cliente e capacidade atuais e mantém gate novo desligado. Não expõe caminhos de objetos nem altera a evidência.

## Limites

Migration não aplicada ou testada. Validar locks dos gates internos, RLS/FORCE, autorização e revogação, paginação concorrente, ausência de Storage público, privacidade, rollout e revisão adversarial. Metadados e decisão não provam autenticidade nem execução.
