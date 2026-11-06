# ADR 1290 — Classificação pública da exceção de material

## Contexto

O Portal informa a existência de uma exceção, mas não distingue falta, parcialidade, material errado ou novo levantamento. O texto livre do evento pode conter informações internas.

## Decisão

Adicionar consulta restrita à lista vigente e publicada, retornando somente classificação enumerada e revisão da lista. Exigir contato ativo da Conta, OS correspondente, gate de visibilidade e conferência de publicação atual. Não devolver texto livre, custos, anexos, autor ou dados do evento. A leitura não representa conferência física, resolução ou alteração de disponibilidade.

## Implantação e retorno

Migration e interface aditivas, com flag desligada. Manter a mensagem genérica anterior como alternativa. Antes de habilitar, testar isolamento de Clientes, revogação, retirada ou atualização concorrente da publicação, eventos antigos, dados legados, privacidade, RLS/FORCE e revisão adversarial. Desligar a flag reverte o acesso pela interface sem remover histórico.
