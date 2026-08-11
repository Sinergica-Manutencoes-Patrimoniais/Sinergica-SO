-- 0192_E03-S07_validar_fk_comercial_contrato.sql — Sinérgica SO
-- Valida a constraint criada NOT VALID em 0191 — transação separada, mesmo padrão de 0091/0092.

alter table financeiro.contratos validate constraint contratos_comercial_contrato_id_fkey;
