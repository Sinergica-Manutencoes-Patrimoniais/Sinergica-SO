---
name: "docs-adr-0884-s172-snapshot-autorizacao-concorrente-md"
description: "Documento Sinérgica SO: ADR-0884 — Autorização concorrente do snapshot de capacidade"
alwaysApply: false
---

# ADR-0884 — Autorização concorrente do snapshot de capacidade

Data: 2026-10-30 · Status: proposta para implementação, gates fechados.

## Contexto

O snapshot parcial S172 é exposto por cinco funções estáveis. No banco sintético isolado, a revogação de `capacidade.gerir` foi iniciada e mantida aberta; uma consulta concorrente retornou dados usando a concessão anterior. A leitura é parcial e não comprova capacidade ou saldo operacional.

## Decisão

Preparar entrada autenticada volátil única para as versões existentes, com isolamento READ COMMITTED, trava compartilhada da autorização e travas compartilhadas dos gates relevantes antes de chamar os núcleos estáveis. Núcleos antigos deixam de ser executáveis por authenticated; a interface passa à nova entrada em rollout coordenado. Preservar regras e formatos de cada versão, os gates fechados e a consulta no mesmo snapshot de instrução dos núcleos. Não introduzir efeito remoto.

A proteção deve respeitar a ordem de travas dos demais fluxos, tratar gates obrigatórios e opcionais, negar execução se a autorização estiver em alteração e revalidar após esperar pelos gates. A cobertura da trava de autorização depende de todos os escritores relevantes cooperarem; acesso de papéis privilegiados, alteração de dados durante a consulta, ACL/HTTP oficiais e completude das fontes exigem provas próprias.

## Consequências

Exige testes de execução, revogação e fechamento de gate nas duas ordens, duas capacidades/Clientes, privilégios e compatibilidade das cinco versões. Antes da liberação, atualizar consumidores e testar a sequência completa das migrations; mudança é incompatível se interface e banco forem implantados separadamente. Não habilitar gates nem homologar até revisão adversarial e evidências oficiais.
