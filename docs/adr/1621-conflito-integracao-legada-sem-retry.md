# ADR-1621: conflitos de revisão na integração legada

A revisão divergente na relação com Plano legado e no lote legado representa rejeição definitiva. O SQLSTATE `40001` pode provocar repetição automática no PostgREST de ensaio.

As guardas específicas passam a retornar `P0011` com `revisao_obsoleta`. Autorização, travas, replay, privilégios e demais erros permanecem iguais. A interface da relação libera nova conferência apenas na primeira resposta definitiva; pedidos incertos continuam preservados.

Consumidores externos que tratem o código anterior devem reconhecer o novo par código e mensagem. Esta decisão não ativa integração nem autoriza chamadas externas.
