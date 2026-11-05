# ADR 1610 — Conflitos de negócio do lote de calendário

Status: aceito para implementação; homologação pendente.

Revisão obsoleta e prévia divergente do lote foram identificadas como rejeições de negócio com `40001`, suscetíveis a reexecução transacional automática. Três guardas explícitas na prévia de origens, no núcleo e na conferência do lote usam `P0015`, mantendo mensagens e replay existente. Na sequência multirrotina apenas a primeira rejeição comprovada permite reconferência; tentativas incertas preservam o request e os recibos anteriores. Erros reais de serialização e outros caminhos não são alterados.
