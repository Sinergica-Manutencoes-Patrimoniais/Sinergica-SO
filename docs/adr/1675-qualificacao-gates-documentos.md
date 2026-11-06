---
name: adr-1675-qualificacao-gates-documentos
description: Qualificação dos gates na listagem privada de documentos de ativo.
alwaysApply: false
---

# ADR-1675 — Qualificação dos gates de documentos

## Estado

Proposta pendente de revisão e ensaio isolado; não altera gates nem autoriza deploy.

## Decisão

A listagem privada histórica retorna uma coluna `id`; os dois `where id` usados para consultar gates podem ser confundidos com essa variável de saída e causar SQLSTATE 42702. A migration 1816 obtém a definição efetiva, exige correspondência única de cada trecho e qualifica apenas as colunas dos dois gates. Divergência aborta a migration. `CREATE OR REPLACE` preserva assinatura e ACL do núcleo; a borda mediada e as verificações de autorização não são alteradas.

## Validação

O ensaio isolado deve testar gate fechado, listagem permitida, Cliente divergente e ausência de EXECUTE direto no núcleo. A qualificação não substitui revisão de owner, concorrência, armazenamento ou testes de produção.
