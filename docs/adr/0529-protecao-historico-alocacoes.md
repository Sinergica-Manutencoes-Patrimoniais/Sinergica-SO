# ADR-0529 — proteção do histórico de alocações

Status: proposto; não aplicado nem homologado. Algumas proteções precisam saber se **existiu** alocação, inclusive estornada; trocar essa verificação pelo saldo ativo alteraria regras de segurança. Um controlador privado de existência histórica preserva essa distinção e é utilizado pelas proteções de lançamento, despesas e correção de modo de proposta, mantendo os gates existentes.

Consultas de detalhamento e auditoria continuam lendo a tabela canônica por necessidade de identidades e eventos; não foram substituídas por totais. A mudança não torna segura uma tabela paralela nem habilita múltiplas parcelas no mesmo documento. Equivalência, isolamento e concorrência exigem revisão e testes antes da aplicação.
