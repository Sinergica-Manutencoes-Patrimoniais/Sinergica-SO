# ADR-0110 — Consulta segura de códigos e transição para aliases

## Estado

Proposta local, não homologada. Migration 0329 não foi aplicada; flag de consulta desativada.

## Decisão

Preparar armazenamento de aliases, sem concessão de escrita direta, e consulta exata por Cliente para códigos existentes e aliases associados ao mesmo ativo. A consulta recusa resolução ambígua e não revela identidade de outro Cliente. O UUID e os códigos legados permanecem intactos. A consulta só considera alias cujo Sistema ou Componente continue no mesmo Cliente; falta garantir essa condição nas futuras escritas e mudanças de vínculo. Grupo Quantitativo não possui código público no modelo atual e não será inventado.

## Limites e gates

Essa fundação não habilita substituição: antes é necessário inventariar colisões globais, estabelecer reserva única com compatibilidade para todos escritores legados e sincronizações, bloqueios de concorrência, marco de uso, auditoria e rollback. Falta resolver como preservar vínculo de alias quando ativo é movido entre Clientes, como integrar buscas e QR e como proteger substituição de sync Auvo. Não ativar antes de CI/db-tests, validação RLS e revisão adversarial. Esta proposta não renumera nem apaga códigos.
