-- 0135_E01-S88_validar_fk_chamado_id.sql — Sinérgica SO
-- Valida a FK adicionada em 0134 (NOT VALID lá, VALIDATE aqui — padrão da casa, ver 0101/0102).

alter table pcm.ordens_servico
  validate constraint ordens_servico_chamado_id_fkey;
