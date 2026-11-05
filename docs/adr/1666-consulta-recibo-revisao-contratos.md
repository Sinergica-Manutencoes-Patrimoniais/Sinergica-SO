# ADR-1666 — Consulta de recibo para modo de revisão alterado

Status: proposta; depende da borda 1807 fechada por padrão.

Uma tentativa pode ter sido armazenada antes de o pedido chegar ao banco. Se o modo configurado mudar, reenviar o comando completo poderia iniciar uma operação em modo que a interface deixou de oferecer. A interface usa então uma borda separada que apenas consulta recibos existentes, sem chamar qualquer comando de criação. Se não houver recibo, mantém a tentativa para tratamento; não gera outra revisão.

A consulta preserva ator autenticado, autorização atual para o Cliente, protocolo de serialização de revogação, gate da borda 1807 e gates próprios do modo, validade do payload, trava de request e vínculo do Plano ao Cliente. Confere as três tabelas históricas, rejeita colisões de modo, ator ou conteúdo e devolve somente o recibo idêntico. Não exige gates transitivos de outros modos para recuperar histórico. O mesmo owner da borda 1807 é exigido na instalação; as verificações de privilégio de 1807 continuam pré-requisito. O acesso é concedido apenas à função de consulta; os núcleos e tabelas continuam privados.

Este recorte não comprova concorrência, implantação no destino ou permissões indiretas. Testes e revisão são necessários antes da ativação; não há deploy nem acionamento do Auvo nesta etapa.
