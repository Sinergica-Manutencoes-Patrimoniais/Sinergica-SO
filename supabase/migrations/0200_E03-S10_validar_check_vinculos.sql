-- 0200_E03-S10_validar_check_vinculos.sql — Sinérgica SO
-- Valida a constraint recriada NOT VALID em 0199 — transação separada, mesmo padrão de 0091/0092.

alter table relacionamento.vinculos validate constraint vinculos_entidade_tipo_check;
