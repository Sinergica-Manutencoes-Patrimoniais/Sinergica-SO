# ADR-0356 — Guarda de cobertura e perguntas opcionais

Status: proposta, não homologada.

Na guarda existente de decisão de aprovação, ausência de resposta só deixa de bloquear quando o snapshot aprovado contém exatamente um contrato congelado inequívoco da mesma Rotina, questionário e pergunta com `obrigatoria=false`. Não se cria resposta nem se interpreta ausência como OK. Snapshots antigos ou contrato ausente, duplicado ou inválido mantêm a regra conservadora anterior. Respostas inesperadas continuam bloqueadas; respostas obrigatórias não inspecionadas mantêm a guarda existente.

Esta mudança não altera o requisito `cobertura_comprovada`, não autentica evidências e não encerra OS. A aprovação continua sob gate fechado e sem EXECUTE. Exige testes de contratos/snapshots legados, concorrência e revisão adversarial antes da ativação.
