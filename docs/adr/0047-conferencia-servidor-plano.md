# ADR-0047 — Conferência de Rotinas no servidor

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

Uma consulta paginada, restrita à concessão atual `plano.gerir`, identifica pendências conhecidas por Rotina e retorna a revisão do Plano usada na consulta. Informa recorrência, data-base, instrução ou questionário, tempo e tipo de tempo, além de alvo ou questionário indisponível. O tempo pendente não é automaticamente classificado como impeditivo: permanece explícito e capacidade não é presumida. Uma lista vazia não é aprovação de Plano vazio.

A consulta é somente leitura e não constitui aprovação; os dados podem mudar após a conferência. O futuro comando de aprovação deve validar novamente, na mesma transação da aprovação e com revisão esperada, além de congelar referências e conteúdo antes de declarar o resultado definitivo. Não usar esta consulta como autorização ou validação transacional substituta.
