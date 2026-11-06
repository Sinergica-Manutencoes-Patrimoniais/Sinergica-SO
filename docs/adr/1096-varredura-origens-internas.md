# ADR-1096 — Varredura local de origens Comercial e Financeiro

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar observação persistente, por objeto e Cliente, de vínculos operacionais comprováveis entre proposta, OS e lista de materiais, e entre faturável e despesa de Visita. A varredura paginada apenas registra classificação e estado local mínimo, com histórico imutável e recibo idempotente; não grava valores, decisão comercial ou financeira, nem altera fonte ou integrações externas.

## Limites

Essa observação não descobre necessariamente origens ausentes, não confirma pagamento nem resolve conflito. A paginação por tipo e UUID não é fotografia; transferências exigem tratamento auditado. Antes de ativação, adaptar autenticação de serviço, executor, acesso por Cliente, privacidade, volume, consistência de origem e revisão adversarial. Gates fechados e nenhuma programação automática.
