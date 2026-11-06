# ADR-1591 — Estado operacional da reconciliação legada

Uma declaração pode continuar válida após a criação legítima de Chamado SSO ou mudança da revisão do Plano. Esses eventos alteram a fotografia histórica, mas não necessariamente invalidam a reserva; orientar o PCM a declarar novamente nesse caso é incorreto.

A consulta retorna separadamente a igualdade da fotografia histórica e `integracaoAtual`, calculada pela mesma guarda que aplica a reserva. A interface só oferece nova declaração quando a integração não está ativa e não há efeito SSO já observado. A guarda, o histórico, os privilégios e os gates continuam em vigor. Erros de autorização e contenção não são convertidos em sucesso. Rollout de banco e interface deve ser coordenado.
