# ADR-1612: conflito definitivo na confirmação da fila de Calendário

A confirmação com estado ou revisão de fila divergente é uma rejeição definitiva, não uma falha de serialização transitória. O PostgREST de ensaio repete `40001` e pode manter a chamada pendente.

A guarda específica de `sso_confirmar_fila_preventiva` retorna `P0012` com a mensagem existente. As verificações de autorização, os locks, o replay e demais SQLSTATE permanecem iguais. A interface libera nova conferência apenas na primeira resposta definitiva; replays e resultados incertos permanecem preservados.

Na aprovação de exceção de Visita, revisão ou data divergente passa a retornar `P0011` com `visita_obsoleta`, também sem alterar replay ou travas. A interface usa o par código e mensagem apenas na primeira tentativa.

Consumidores externos que inspecionem o código anterior devem reconhecer `P0012` junto de `fila_ou_revisao_indisponivel`. Não há ativação nem comunicação externa nesta alteração.
