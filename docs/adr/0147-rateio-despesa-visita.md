# ADR-0147 — Rateio de despesa por OS da Visita

**Estado:** proposta, comandos revogados; não homologada nem implantada.

Rateio é versão imutável de parcelas inteiras em centavos, sem criar despesas adicionais. Lista vazia representa ausência de rateio; caso contrário, soma exatamente o realizado, ou o previsto quando não houver realizado. Cada parcela aponta vínculo vigente de OS da mesma Visita e Cliente; atualizações exigem revisão esperada, autorização atual e pedido idempotente. Alteração posterior do valor que invalide o rateio é recusada até que o rateio seja removido ou corrigido.

Antes de habilitar, integrar a transferência/encerramento dos vínculos de Visita com rateios vigentes, definir relatórios sem dupla contagem, tratar concorrência com edição da despesa, conferir controles de Conta e permissão e executar revisão adversarial e testes integrados. O comando preparado não permite afirmar que vínculos permanecem vigentes após a gravação. Migrations e flags permanecem fechadas.
