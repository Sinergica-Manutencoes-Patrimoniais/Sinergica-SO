-- 0195_E03-S07_validar_check_valor_mensal.sql — Sinérgica SO
-- Valida a constraint recriada NOT VALID em 0194 — transação separada, mesmo padrão de 0091/0092.

alter table comercial.contratos validate constraint contratos_valor_mensal_centavos_check;
