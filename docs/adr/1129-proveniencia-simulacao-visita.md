# ADR-1129 — Proveniência declarada da simulação de Visita

Status: proposta local, não aplicada nem homologada.

Preparar entrada que registra, junto à reprogramação já mediada, se subtotais parciais foram usados na semana de origem e no destino. Os dados são declaração do operador, não atestado de fonte ou capacidade; se houver subtotal parcial, o alerta de capacidade não verificada é obrigatório. O mesmo requestId, transação e recibo vinculam a declaração e a transição existente. Não altera vencimento, não envia tarefa e não comprova disponibilidade.

Antes de ativar, testar replay, rollback, permissões, gates, concorrência, omissão de campos, troca de Cliente/sessão e revisão adversarial. Outros caminhos de transição não são cobertos; dados de capacidade detalhados não são armazenados nesta decisão.
