# ADR-0276 — Quantidade motivada na incorporação de Grupo

O comando de incorporação de Grupo existente não fornece motivo e é corretamente bloqueado quando a proteção transversal de quantidade está ativa. Prepara-se um wrapper privado com motivo obrigatório e idempotência própria que concede autorização transacional somente à chamada interna e preserva as revisões, validação de lote, campos e transação originais. Mudança de quantidade produz evento adicional auditável com motivo; retries não duplicam o evento.

A nova entrada não concede execução nem ativa gates. A chamada antiga permanece bloqueada se tentar mudar quantidade com a proteção ligada; não se converte motivo de linha em autorização implícita. A integração da interface e testes de concorrência/rollback são necessários antes da ativação.
