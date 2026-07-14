-- 0092_E01-S73_validar_constraints_inspecoes.sql — Sinérgica SO
-- Valida as constraints criadas NOT VALID em 0091 — transação separada, mesmo padrão de 0071/0074/0083.

alter table pcm.inspecoes validate constraint inspecoes_tipo_inspecao_id_fkey;
alter table pcm.inspecao_itens validate constraint inspecao_itens_resultado_check;
