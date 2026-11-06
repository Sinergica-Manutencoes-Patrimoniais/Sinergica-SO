# ADR-1624: divergência definitiva no vínculo PMOC

Plano ou decisão divergente no vínculo de ciclo ao PMOC é rejeição de negócio, não serialização transitória. O SQLSTATE `40001` pode provocar repetição automática no PostgREST de ensaio.

As duas guardas específicas passam a retornar `P0019` com suas mensagens existentes. Autorização, travas, replay, privilégios e demais erros permanecem iguais. A interface libera nova conferência somente na primeira resposta definitiva; replay e resultado incerto continuam preservados.

Consumidores externos devem reconhecer o novo código junto das mensagens. Não há ativação, deploy nem comunicação externa nesta alteração.
