# ADR-1637: mediação de vigências de Rotina por Visita

## Contexto

A tela de vigências chamava diretamente três funções privadas, causando recusa de acesso mesmo para PCM autorizado.

## Decisão

Mediar consulta, histórico e decisão com ator autenticado, Cliente e permissões existentes, trava de autorização e Plano correspondente. Preservar os núcleos, suas validações, gates, histórico e replay; conceder os mediadores apenas a `authenticated`.

A guarda explícita de revisão obsoleta no encerramento usa `P0011`; erros reais de serialização permanecem `40001`. A interface só permite nova conferência após rejeição específica na primeira tentativa, preservando pedido incerto.

## Consequências

O acesso depende também dos gates e regras dos núcleos. Não são alterados calendários, OS ou fontes externas por esta mediação.
