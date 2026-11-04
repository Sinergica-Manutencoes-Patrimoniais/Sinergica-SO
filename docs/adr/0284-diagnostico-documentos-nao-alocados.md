# ADR-0284 — Diagnóstico de lançamentos não alocados

Status: proposta; sem ativação nem testes.

Na ausência de entidade canônica de "documento pendente", a consulta identifica somente lançamentos de entrada existentes do Cliente e competência que não possuem alocação ativa no novo fluxo. Distingue lançamento sem documento SSO de documento sem alocação ativa; estorno lógico não é reconciliação. Não presume que todo lançamento precise ser alocado, não infere pagamento nem soma valores por página. Não altera lançamento e não cria cobrança. Gate, permissão de Financeiro e escopo de Cliente são revalidados no servidor.
