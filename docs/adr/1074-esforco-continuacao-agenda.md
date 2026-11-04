# ADR-1074 — Esforço remanescente na agenda

**Status:** preparação não homologada. Complementa ADR-1071 e E01-S172.

A fonte de capacidade pode incluir, para OS de continuidade vinculadas, os minutos remanescentes registrados na proposta aprovada. O subtotal é separado das declarações de HH: o mesmo tempo pode já estar declarado, portanto não se soma automaticamente aos minutos internos ou de terceiros. A interface deduplica por OS nas páginas carregadas e exclui valores conflitantes; não afirma disponibilidade, unidade de equipe, execução ou demanda total.

A consulta usa a fonte autorizada de capacidade e confere Cliente, proposta executada e vínculo de continuidade. Gate de continuidade e flag de interface continuam fechados. Paginação não forma fotografia transacional; validar autorização, revogação, múltiplas Visitas, reprogramação, conflitos de unidades, duplicidade com outras fontes, desempenho e revisão adversarial antes de habilitar. Cobertura integral segue pendente.
