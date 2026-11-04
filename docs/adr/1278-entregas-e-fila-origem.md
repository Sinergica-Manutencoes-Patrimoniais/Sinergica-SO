# ADR-1278 — Acompanhamento de entregas da inbox

Status: proposta local; não aplicada nem homologada.

Cada envelope observado deve ter recibo imutável relacionado à tarefa e OS, inclusive quando representa repetição ou conflito de ordem já registrada. Isso permite distinguir captura da aplicação de um evento, sem criar mais de uma OS. Envelopes ainda sem recibo são candidatos a nova tentativa; não se presume que foram processados, nem se transforma Cliente desconhecido em erro definitivo.

A consulta de candidatos é paginada, privada ao serviço e não faz claim, reserva ou agendamento. Sem lease, duas instâncias podem consultar a mesma entrada; a serialização e idempotência no processamento continuam obrigatórias. O cursor não é fotografia integral e uma nova varredura precisa começar do início. Antes de uso: validar concorrência, locks, reentrega, criação transacional, backpressure, retenção, segurança, RLS/FORCE e revisão adversarial. Gates permanecem fechados.
