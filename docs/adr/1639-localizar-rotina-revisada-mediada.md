# ADR-1639: localização mediada da Rotina revisada

## Contexto

A interface chamava diretamente uma função privada ao localizar a cópia da Rotina aprovada no rascunho, impedindo a consulta autenticada.

## Decisão

Mediar a leitura usando a conferência de ator, Cliente, permissão `plano.gerir` e travas de autorização e Plano introduzida na 1780. O núcleo privado conserva gate, validação de identidade histórica, versão e rascunho, sem ampliação de ACL.

## Consequências

A localização não altera dados nem inicia edição. Migração e interface precisam de validação antes de homologação.
