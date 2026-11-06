---
name: "docs-adr-0711-acesso-calendario-pcm-md"
description: "Documento Sinérgica SO: ADR-0711 — Acesso às operações preparadas de calendário"
alwaysApply: false
---

# ADR-0711 — Acesso às operações preparadas de calendário

Status: preparada; não aplicada nem homologada.

As superfícies de calendário chamam funções existentes sem `EXECUTE` para `authenticated`. Conceder exclusivamente as oito RPCs externas de próxima data, identidade histórica, feriado, triagem e materialização preparada, cujas definições atuais exigem gate privado e autorização `plano.gerir` no Cliente; suas escritas preservam revisão, request e validação de origem.

Não conceder acesso a tabelas, funções auxiliares, `anon` ou `service_role`; não ativar gates, criar OS ou acionar Auvo. A concessão não prova correção ou isolamento: testes de autorização, revogação, idempotência e concorrência, além de revisão adversarial, continuam obrigatórios antes da ativação.
