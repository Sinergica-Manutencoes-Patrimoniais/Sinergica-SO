-- 0129_E01-S83_validar_fk_origem_inspecao.sql — Sinérgica SO
-- Valida a FK adicionada em 0128 (NOT VALID lá, VALIDATE aqui — não bloqueia leitura/escrita
-- concorrente durante o scan, mesmo padrão de 0073/0074).

alter table pcm.ordens_servico
  validate constraint ordens_servico_origem_inspecao_item_id_fkey;
