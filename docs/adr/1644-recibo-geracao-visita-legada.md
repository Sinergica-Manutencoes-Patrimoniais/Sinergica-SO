# ADR-1644: recuperação de recibo da geração contratual legada

## Contexto

O protocolo coordenado rejeita request já registrado pela geração antiga. Os caminhos anteriores estão privados e não devem ser reabertos para novas gerações.

## Decisão

Novos pedidos usam o protocolo coordenado quando disponível. Pedidos antigos consultam somente o recibo imutável mediante ator, Cliente, permissões, gates e payload idêntico, sob a trava do request original. Se não houver recibo, o mediador falha fechado e preserva o pedido, sem criar Visita ou suprimir semana.

## Consequências

A recuperação não muda o protocolo histórico nem presume que pedido sem recibo foi executado. Não comprova fontes externas. Migração e interface requerem revisão e validação antes de homologação.
