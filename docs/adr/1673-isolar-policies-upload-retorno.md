---
name: adr-1673-isolar-policies-upload-retorno
description: Isolar avaliação de policies de outros buckets no upload de evidência de retorno.
alwaysApply: false
---

# ADR-1673 — Isolamento de policies no upload de retorno

## Estado

Proposta para validação em clone; não aplicada nem homologada. O gate de upload permanece fechado por padrão.

## Contexto e decisão

Uma tentativa de upload de retorno encontrou erro de permissão em helper privado de foto de levantamento, referente a outro bucket. As policies coexistem em `storage.objects` e a ordem de avaliação de expressões booleanas não deve ser presumida.

A migration 1814 altera somente os pares permissivo e restritivo de fotos de Grupo, fotos de levantamento e documentos de levantamento. Para o bucket `sso-retorno-evidencias`, esses pares retornam respectivamente falso e verdadeiro sem chamar os helpers alheios. Para qualquer outro bucket, preservam a expressão anterior integral. Um preflight compara a expressão canônica, comando, papéis e natureza permissiva/restritiva das seis policies antes de qualquer alteração; divergência aborta a migration. Não concede EXECUTE adicional, não abre gates e não altera policies de leitura, update ou delete.

## Limites

Os uploads dos outros buckets continuam sujeitos às permissões e gates próprios; esta mudança não os habilita. A equivalência de policies, os casos de Cliente divergente, o upload de retorno e as demais combinações exigem ensaio isolado, revisão e verificação do catálogo real antes de rollout. A alteração preserva histórico; reversão operacional exige migration aditiva após analisar o estado efetivo, nunca edição de migrations anteriores.
