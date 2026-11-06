# ADR-1149 — Resultado conservador T−24 na outbox

Status: proposta local; não aplicada nem homologada.

O resultado bloqueado, incerto ou pendente de reconciliação deve ser gravado na mesma transação que encerra a reivindicação da linha correspondente da outbox em `error`. A mensagem da fila é somente um código genérico, sem payload, identificadores externos ou conteúdo. O histórico e recibo do livro preservam o motivo e fence. Uma repetição da mesma requisição retorna o recibo sem repetir a alteração; conteúdo divergente é recusado pelo comando de resultado. Nenhum desses estados representa sucesso ou autoriza novo envio.

O invólucro toma a linha da outbox antes do livro, conforme ADR-1148; o núcleo anterior continua privado e só pode ser chamado pelo invólucro após integração. Não há concessão de execução. Outros escritores, varredura de efeito incerto, correção de estados e reconciliação da fila ainda precisam ser integrados. Validar serialização, autorização, retry, gate, ordem de locks, rollback, mudanças de status por outros consumidores, FORCE RLS e revisão adversarial antes de ativar.
