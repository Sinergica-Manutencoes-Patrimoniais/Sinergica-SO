-- 0071_E01-S38_validar_fk_tecnico_ordens_servico.sql — Sinérgica SO
-- Valida a FK criada NOT VALID em 0070 — transação separada, mesmo padrão de 0005/0007/0045.

alter table pcm.ordens_servico validate constraint ordens_servico_tecnico_funcionario_id_fkey;
