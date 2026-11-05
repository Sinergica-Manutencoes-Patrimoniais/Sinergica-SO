# ADR 1648: serialização da administração de capacidades

Os comandos de concessão, perfil e vínculo verificam o papel atual do administrador antes de gravar. As fontes de autorização já são serializadas pela chave transacional de 0319, mas a trava obtida pelo gatilho de escrita chega depois dessa verificação. Uma mudança concorrente do usuário poderia confirmar nesse intervalo.

Os três comandos passam a tentar obter a mesma trava exclusiva antes da autorização e da consulta de recibo, exigindo isolamento READ COMMITTED. A tentativa sem espera retorna `55P03` quando outra alteração está em andamento; o chamador preserva o pedido para repetição. A trava exclusiva evita promoção de compartilhada para exclusiva nos gatilhos de escrita. A autorização e a conferência do ator e do payload continuam obrigatórias também no replay; assinaturas, privilégios e dados históricos são preservados.

A decisão não oferece revogação instantânea para consultas armazenadas no navegador. Compilação e ensaios, incluindo concorrência e replay, permanecem pendentes.
