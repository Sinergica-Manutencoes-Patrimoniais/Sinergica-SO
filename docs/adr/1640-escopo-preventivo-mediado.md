# ADR-1640: declaração de escopo preventivo mediada

## Contexto

As telas de seleção, prévia, diagnóstico e declaração de escopo preventivo chamavam funções privadas, sem permissão direta para usuários autenticados.

## Decisão

Mediar os quatro caminhos com ator, Cliente, Plano, permissão existente `execucao.validar` e travas de autorização e Plano. A declaração confere que a ocorrência pertence ao Plano; os núcleos privados preservam gates, validações, histórico e replay.

A revisão obsoleta explícita na declaração usa `P0011`; erros genuínos de serialização mantêm `40001`. A interface permite reconferir apenas após rejeição específica na primeira tentativa, preservando pedido incerto.

## Consequências

A declaração não congela escopo nem conclui ocorrência. A migração e a interface exigem revisão e validação antes de homologação; não ativam integrações externas.
