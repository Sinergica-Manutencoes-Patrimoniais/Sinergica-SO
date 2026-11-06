# ADR-0199 — Histórico das decisões preliminares de vencimento

Status: proposta, não homologada.

Consulta paginada por Plano, versão, Rotina, ciclo e data exibe decisões preliminares imutáveis, com ator, data e motivo, somente a gestor autorizado do Cliente. Cursor composto por instante e UUID evita perda em empates. A consulta usa o gate fechado das transições e permanece revogada. Não confirma obrigação, pendência, dispensa, execução ou adequação do tratamento.

Antes de liberar, verificar isolamento, paginação, autorização atual, risco de informações sensíveis em motivos, retenção e concorrência. Reconciliação de ciclos entre versões e tratamento operacional continuam pendentes.
