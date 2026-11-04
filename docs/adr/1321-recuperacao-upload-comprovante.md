# ADR-1321 — Recuperação de upload mediado de comprovante

Estado: preparação local, desabilitada; não autoriza implantação ou abertura de gates.

Uma reserva pendente pode representar upload concluído sem confirmação recebida, upload ainda em andamento ou ausência de objeto. Retentar o envio às cegas não distingue esses casos.

Preparar consulta privada, utilizável somente pelo serviço, que revalida ator, Cliente, despesa, pedido, digest e gates pelos mecanismos existentes e localiza exclusivamente o objeto privado no caminho da reserva. Quando não houver objeto único, a tentativa continua pendente; ausência não autoriza novo upload. Quando houver objeto, a borda deve reler seus bytes, conferir o digest, revalidar autorização e confirmar pelo mesmo requestId. Nenhum caminho ou detalhe do objeto é devolvido a usuário não autorizado. A funcionalidade depende de gate próprio fechado no banco e flag de Edge desligada por padrão.

O digest comprova correspondência no momento da leitura, não autenticidade da origem nem imutabilidade futura. Upload ainda em curso, remoção/substituição concorrente, múltiplas requisições, revogação, ACL/RLS, falha após confirmação e Storage HTTP real exigem testes integrados e revisão adversarial. A ausência de objeto permanece inconclusiva; não apagar reservas nem automatizar repetição. A migração é aditiva e não modifica as policies compartilhadas. Rollback exige desabilitar gate e flag antes de remover a nova função e somente após confirmar ausência de chamadas em voo; registros e objetos existentes são preservados.
