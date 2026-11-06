---
name: "docs-adr-0723-desambiguacao-listagem-fotos-ativo-md"
description: "Documento Sinérgica SO: ADR 0723 — Desambiguação da listagem de fotos de ativo"
alwaysApply: false
---

# ADR 0723 — Desambiguação da listagem de fotos de ativo

## Contexto

A função de listagem prevista no ADR-0720 retorna uma coluna `id`. Em PL/pgSQL, o uso de `where id` sem qualificação nos dois gates conflita com essa variável de saída e impede toda listagem, inclusive quando autorizada. O teste pgTAP reproduz o erro 42702 em banco diagnóstico isolado.

## Decisão

Substituir a definição da função por migration aditiva, qualificando as colunas dos dois gates com seus aliases. Preservar assinatura, retorno, filtros de Cliente e adequação, paginação e privilégios: somente a função mediada continua acessível ao usuário autenticado. Nenhuma tabela, foto, objeto, vínculo ou histórico é modificado.

## Implantação e verificação

Executar primeiro em banco descartável, incluindo casos de autorização, revogação e Cliente divergente. A sequência anterior precisa de reconciliação e a CI com db-tests, além da revisão adversarial, continua necessária. A correção não habilita gates nem comprova segurança do Storage ou concorrência. Rollback deve substituir a função por outra definição segura; não reintroduzir a ambiguidade ou ampliar privilégios.
