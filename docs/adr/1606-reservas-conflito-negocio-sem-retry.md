# ADR 1606 — Conflitos de reservas sem retry transacional

Status: aceito para implementação; homologação pendente.

RPCs de reserva usam `40001` para rejeições de negócio, o que provoca reexecução automática incessante pelo PostgREST. As guardas explícitas de revisão, fotografia, reserva e escolha obsoletas nas nove RPCs de prévia e decisão de reserva passam a `P0013`, preservando suas mensagens. Erros reais de serialização e funções fora desse conjunto não são convertidos. Na primeira tentativa, as telas só descartam uma rejeição comprovada desse contrato após conferir sessão e pedido; replay incerto permanece preservado. Triggers de aprovação e escolhas de nova data continuam fora deste recorte. Sem efeito em Auvo.
