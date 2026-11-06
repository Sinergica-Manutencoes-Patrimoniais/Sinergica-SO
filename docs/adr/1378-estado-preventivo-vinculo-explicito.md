---
name: "docs-adr-1378-estado-preventivo-vinculo-explicito-md"
description: "Documento Sinérgica SO: ADR-1378 — Vínculo explícito na verificação preventiva"
alwaysApply: false
---

# ADR-1378 — Vínculo explícito na verificação preventiva

**Estado:** proposta; não aplicada nem homologada.

## Contexto e decisão

O estado da fonte preventiva examina o vínculo legado e as OS que atualmente apontam para ele. Um vínculo explícito histórico à ocorrência ou a outra versão do mesmo ciclo pode permanecer mesmo se o vínculo direto da OS divergir. Nessa situação, tratar a fonte como candidata aguardando pode ocultar trabalho existente.

Manter o contrato da consulta e o núcleo anterior privado. Quando a fonte legada indicar candidata aguardando, verificar, sob trava, vínculos explícitos da ocorrência e de ocorrências identificadas no mesmo ciclo canônico. A existência de qualquer vínculo altera somente o diagnóstico para `indeterminado`; não altera dados, cancela OS ou afirma execução. Inclusão e confirmação da fila reutilizam a mesma guarda.

## Limites

A ausência desse vínculo não prova ausência de efeitos remotos ou de outras fontes. Validar definição instalada, ACL/RLS/FORCE, compatibilidade dos consumidores, locks, concorrência, vínculos excluídos/divergentes, outras versões e revisão adversarial antes de implantar.
