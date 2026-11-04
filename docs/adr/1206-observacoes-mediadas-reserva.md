# ADR-1206 — Observações mediadas de reserva Equipment

## Decisão

Preparar entradas autenticadas de leitura e registro das observações da reserva, mantendo privados os núcleos e seus gates. A entrada exige sessão igual ao ator, capacidade `cadastro.gerir` e vínculo atual entre Cliente, Componente e reserva; o núcleo conserva auditoria, requestId e histórico imutável.

A observação é uma declaração humana, não evidencia efeito externo e não libera ou reenvia Equipment. Em caso de reserva removida ou transferida, a nova via recusa inclusive repetição; isso pode exigir reconciliação humana para recibo incerto, sem revelar o Cliente anterior.

## Gates

Flag de interface e gates permanecem fechados até testes de autorização, isolamento, replay, confirmação concorrente, transferência e revisão adversarial. Verificar privacidade do texto e ordem global das travas antes de ativar.
