# ADR 1636: vínculo mediado de série e Rotina

O comando de vínculo expõe apenas uma entrada autenticada que verifica ator, Cliente e concessões sob a trava de autorização e bloqueia o Plano. O núcleo privado preserva revisão, gate e recibo idempotente; o comando não gera ocorrência nem aciona Auvo.

Revisão obsoleta usa `P0011`; `40001` permanece reservado à serialização real. A interface só libera nova conferência após rejeição definitiva no primeiro envio; pedidos incertos mantêm o identificador para repetição.
