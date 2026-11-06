---
name: "docs-adr-0887-s172-leitura-escopo-serializada-md"
description: "Documento Sinérgica SO: ADR-0887 — Consulta de escopo serializada"
alwaysApply: false
---

# ADR-0887 — Consulta de escopo serializada

Data: 2026-10-30 · Status: proposta para implementação, gates fechados.

A consulta individual de escopo retornou dados durante revogação de `execucao.validar` em ambiente sintético. Introduzir entrada volátil com READ COMMITTED, trava compartilhada da autorização e dos gates de escopo e origem; delegar a validação de Cliente, OS e origem ao núcleo estável existente. Remover execução autenticada direta do núcleo e atualizar adapter em rollout coordenado. O resultado segue declarativo e não comprova execução.

Proteção depende da cooperação dos escritores de autorização; testar concorrência nas duas ordens, gates, isolamento de Clientes e permissões oficiais. Não abrir gates ou homologar sem revisão adversarial; nenhum efeito Auvo.
