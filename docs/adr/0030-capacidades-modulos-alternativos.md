# ADR-0030 — Módulos elegíveis por capacidade

**Status:** Decisão para implementação local da E01-S170. **Data:** 2026-10-26.

Uma ação pode ser legítima em mais de um domínio. Em particular, `custo.ler` precisa funcionar para pessoas autorizadas do Comercial ou do Financeiro, sem exigir acesso ao outro módulo.

A elegibilidade de módulo será uma relação aditiva `ação → módulo + nível mínimo`, com uma ou mais opções. A autorização exige usuário ativo, ao menos um módulo elegível atual e a concessão explícita para ação e Cliente. Ter módulo sozinho nunca concede capacidade; nenhuma concessão é criada automaticamente. O campo de módulo original do catálogo é preservado como fonte de compatibilidade e preenchido na nova relação; inicialmente `custo.ler` admite leitura Comercial ou Financeiro.

A migração não altera os grupos legados, não remove histórico e não autoriza exportação ou custos sem concessão. Testes devem provar autorização em cada módulo permitido, ausência de concessão, isolamento de Cliente e revogação com JWT antigo. Outras combinações só entram no catálogo quando a story consumidora estabelecer sua necessidade.
