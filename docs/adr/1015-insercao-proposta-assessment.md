# ADR-1015 — Autorização de assessment na inserção de proposta

Status: preparação fechada, não homologada. Complementa ADR-1014.

Quando o gate de escrita mediada estiver habilitado, uma proposta inserida já com assessment exige sessão e capacidade `orcamento.emitir` no Cliente da oportunidade. A guarda de integridade existente continua conferindo que o assessment pertence ao mesmo Cliente. A inserção sem assessment permanece no fluxo legado. Não exigir que a inspeção histórica esteja ativa, pois duplicação de proposta preserva o vínculo de inspeção arquivada.

A guarda não aprova custos, não altera a cópia nem substitui as policies e regras de Comercial. Validar duplicação, atores de integração, capacidade, isolamento, reentrância de locks, concorrência e dados legados antes de ativar os gates. Execução e homologação permanecem bloqueadas.
