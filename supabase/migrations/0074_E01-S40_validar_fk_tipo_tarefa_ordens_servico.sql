-- 0074_E01-S40_validar_fk_tipo_tarefa_ordens_servico.sql — Sinérgica SO
-- Valida a FK criada NOT VALID em 0073 — transação separada, mesmo padrão de 0005/0007/0045/0071.

alter table pcm.ordens_servico validate constraint ordens_servico_tipo_tarefa_id_fkey;
