-- 0212_E01-S153_validar_constraint_os_equipamento.sql — Sinérgica SO
-- Completa a FK NOT VALID de 0211 — mesmo padrão de 0096 (VALIDATE fora da migration que cria a
-- constraint, evita lock longo na mesma transação de escrita em pcm.ordens_servico).
--
-- Reverso: não aplicável (VALIDATE é idempotente; reverso real é o de 0211).

alter table pcm.ordens_servico validate constraint fk_ordens_servico_equipamento;
