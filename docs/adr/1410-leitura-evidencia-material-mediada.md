---
name: "docs-adr-1410-leitura-evidencia-material-mediada-md"
description: "Documento Sinérgica SO: ADR-1410 — Consulta mediada de evidências de materiais"
alwaysApply: false
---

# ADR-1410 — Consulta mediada de evidências de materiais

## Decisão

Expor ao PCM consulta limitada de identificadores e datas de evidências de uma exceção, verificando ator, Cliente, permissão e gates antes de chamar a função privada. O objeto continua privado; a consulta não transfere imagens nem comprova seu conteúdo.

## Limites

Migration não aplicada nem testada. A ingestão e o download dependem de fronteiras próprias e permanecem sujeitos aos respectivos gates. Validar autorização, concorrência e revogação, RLS/FORCE, paginação, privacidade, Storage e revisão adversarial antes de habilitar.
