---
name: "docs-adr-0857-bloqueio-aprovacao-revisao-sem-prova-md"
description: "Documento Sinérgica SO: ADR 0857 — Aprovação de revisão sem prova de impactos"
alwaysApply: false
---

# ADR 0857 — Aprovação de revisão sem prova de impactos

## Contexto

A aprovação de revisão utiliza um token privado para encerrar a vigência anterior. A proteção existente só o rejeita quando sua própria flag está ativa; habilitar isoladamente a aprovação permite avançar sem demonstrar impacto integral em ocorrências, visitas e OS legadas. A fotografia atual declara explicitamente que essas fontes não estão comprovadas.

## Decisão

Rejeitar sempre a emissão do token de aprovação de revisão enquanto não houver verificador transacional completo de impactos. A proteção atua mesmo quando a flag anterior está desligada; aprovação inicial não usa esse token e não é modificada. A interface mantém confirmação da revisão indisponível independentemente da configuração do preflight. Nenhuma flag é habilitada por esta decisão.

## Consequências

A aprovação de versões subsequentes fica bloqueada também em ambientes que antes a habilitaram; não aplicar sem avaliar compatibilidade operacional. Nova decisão arquitetural, prova integral das fontes, concorrência, histórico e revisão adversarial são necessárias antes de substituir esta proteção. Não constitui autorização de deploy nem homologação.
