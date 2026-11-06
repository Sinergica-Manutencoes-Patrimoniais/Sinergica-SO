---
name: "docs-adr-0859-serializar-identidade-e-decisao-visita-md"
description: "Documento Sinérgica SO: ADR 0859 — Serialização parcial das fontes de impacto de Visita"
alwaysApply: false
---

# ADR 0859 — Serialização parcial das fontes de impacto de Visita

## Contexto

A avaliação de revisão consulta a identidade de Visita e a última decisão de impacto. A trava global da migration 0787, estendida por 1001 e 1006, não cobria inserções nas tabelas `sso_ciclo_visita_versoes`, `sso_ciclos_visita_canonicos` e `sso_decisoes_impacto_visita`. Com o protocolo ligado, essas inserções podem ocorrer enquanto uma fotografia de impactos detém a trava.

## Decisão

Aplicar às inserções dessas três tabelas o protocolo opt-in existente, com o mesmo bloqueio não aguardado. O gate continua desligado por padrão. As tabelas já são protegidas contra atualização e exclusão, e nenhuma política, permissão ou aprovação é habilitada.

## Consequências e limites

Esta mudança reduz a lacuna demonstrada; não comprova inventário completo, equivalência com legado, proteção de transações anteriores à ativação, resolução de impactos ou suficiência para aprovação. O protocolo é global, pode gerar contenção e erros de retry; avaliar compatibilidade e escritores existentes antes de ativar. Homologação, revisão adversarial e deploy continuam bloqueados.
