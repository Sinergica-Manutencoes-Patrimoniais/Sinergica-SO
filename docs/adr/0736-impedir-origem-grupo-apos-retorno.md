# ADR-0736 — Bloquear associação Grupo após retorno já registrado

## Status

Proposta; gate de associação continua desligado. Não libera os consumidores de Grupo nem comprova segurança concorrente.

## Contexto e decisão

A guarda 0903 rejeita novo retorno de OS que já esteja vinculada a Grupo. A ordem inversa permitia inserir vínculo Grupo numa OS com retorno anterior, alterando retroativamente sua origem aparente. Introduzir uma guarda aditiva no vínculo, ativa apenas com o gate existente de associação, para rejeitar OS com retorno preparado ou pendência técnica anterior. Vínculos históricos não são alterados; replay idêntico da função existente conserva resultado anterior sem criar novo vínculo.

O teste sequencial usa dados sintéticos em transação revertida: cria retorno, tenta associar Grupo e exige recusa. Acrescentar casos de ausência de retorno, permissões e repetição antes da homologação.

## Limites e reversão

A consulta da guarda não serializa a inserção concorrente de retorno: não representa prova de segurança para duas sessões. O gate de associação deve permanecer desligado até um protocolo de locks entre associação, retorno, decisões, pendências e demais escritores ser implementado e testado. Não alterar registros para compensar casos históricos. Reversão futura somente após avaliação: remover o trigger e sua função, preservando tabela e dados; não ativar caminhos inseguros como parte da reversão.
