-- 0140_E01-S91_validar_fk_clientes_marcacao.sql — Sinérgica SO
-- Valida a FK NOT VALID criada em 0139 (transação separada, mesmo padrão de 0128/0129, 0137/0138).

alter table pcm.clientes
  validate constraint clientes_marcacao_id_fkey;
