# ADR-0073 — Proteção de OS encerrada na composição

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

No modelo legado, `finalizado` e `cancelado` são estados históricos de OS (Cliente 360, E01-S145). A seleção, associação e confirmação de nova Visita recusam essas duas situações, sem reclassificar dados existentes ou renomear status. Para parcial encerrada, fluxo aprovado exige OS de continuação com escopo restante (E01-S167), não reutilização silenciosa da encerrada.

Associação e confirmação revalidam OS sob lock; consultas não são autoridade. Retry de operação já concluída devolve resultado original sem recriar vínculo. Outros estados legados continuam disponíveis nesta etapa, sem afirmar homologação; E01-S167 deve definir as transições canônicas e E01-S168 revalidar na transação de envio. Nenhum vínculo legado é apagado ou convertido.
