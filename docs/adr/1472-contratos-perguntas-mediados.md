---
name: "docs-adr-1472-contratos-perguntas-mediados-md"
description: "Documento Sinérgica SO: ADR-1472 — Contratos de perguntas mediados no Plano"
alwaysApply: false
---

# ADR-1472 — Contratos de perguntas mediados no Plano

Status: preparação local, gates fechados e sem homologação.

A S165 referencia questionários existentes e precisa editar, consultar e auditar a obrigatoriedade e as evidências de cada pergunta em rascunho. Os núcleos existentes permanecem privados. Preparar entradas específicas por Cliente e Plano, com autenticação, capacidade `plano.gerir`, trava de autorização, locks dos gates e do Plano, preservando revisão, requestId e auditoria dos comandos originais. Leituras e escritas usam gate adicional inicialmente fechado; nenhuma alteração publica ou modifica o questionário no Auvo.

O Plano é travado para atualização nas escritas e para leitura nas consultas; a operação original conserva as validações de versão, Rotina e pergunta. A prévia e os contratos por si só não comprovam execução. Rollout exige testes de autorização/revogação, isolamento entre Clientes, concorrência e ordem de locks, histórico, replay, RLS/FORCE e revisão adversarial. Não autoriza deploy nem alteração no Auvo.
