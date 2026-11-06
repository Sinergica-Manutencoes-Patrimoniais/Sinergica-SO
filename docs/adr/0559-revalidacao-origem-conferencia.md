# ADR-0559 — origem na conferência de faturável

Status: proposto; gate fechado, não aplicado nem homologado. A primeira fatia protege conferência de item base de despesa de Visita: bloqueia a despesa antes do item, verifica Cliente, revisão registrada na declaração, valor realizado e identidade. Pedido já concluído segue recuperação idempotente pelo comando existente. Com gate fechado, comportamento legado é preservado. Para outras origens e complementos, gate ligado rejeita a conferência até haver adaptadores de origem comprovados, em vez de inferir valores.

Ordem de locks, fontes mutáveis, concorrência com correções e fechamento, isolamento entre Clientes e integração de outras origens exigem testes e revisão adversarial. Esta proteção não comprova orçamento, distribuição ou emissão, e não autoriza cobrança externa.
