---
name: adr-1669-execucao-politica-upload-retorno
description: Define a permissão mínima para avaliar políticas de upload de evidência.
alwaysApply: false
---

# ADR-1669 — Execução da política de upload de evidência de retorno

## Contexto

A política de INSERT de `storage.objects` criada em 0556 chama `pcm.sso_autorizar_upload_evidencia_resposta(text)` como `authenticated`. A função foi revogada desse papel e a política falha por falta de EXECUTE. Sua finalidade é devolver somente um booleano sobre o caminho fornecido, após conferir ator autenticado, gates, bucket privado, formato, Cliente, retorno e `execucao.validar`.

## Decisão

Conceder exclusivamente EXECUTE em tal assinatura a `authenticated`, sem concessão a `anon`, PUBLIC ou outros papéis e sem alteração da política, dos gates ou do bucket. A chamada direta não deve revelar caminhos nem dados: apenas responde ao caminho já fornecido, condicionado à autorização atual. Upload e leitura continuam sujeitos às políticas existentes. A migration exige que função e política esperadas existam; falha se o contrato não estiver presente.

## Limites

A concessão apenas permite avaliar a política; não comprova o upload HTTP, concorrência de revogação, autenticidade dos bytes, integridade do Storage nem prontidão para produção. Os gates permanecem fechados. Validar casos permitido e negado com Auth e Storage reais em clone descartável antes de homologar; verificar ACL e comportamento no ambiente de destino antes de qualquer rollout. Reversão: revogar EXECUTE de authenticated, sabendo que isso volta a bloquear o upload.
