-- 0138_E01-S90_validar_fk_chamados_origem_inspecao.sql — Sinérgica SO
-- Valida a FK NOT VALID criada em 0137 (transação separada, mesmo padrão de 0128/0129, 0134/0135).

alter table pcm.chamados
  validate constraint chamados_origem_inspecao_item_id_fkey;
