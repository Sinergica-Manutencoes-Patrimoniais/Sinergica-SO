-- 0098_E01-S76_validar_constraint_local_tipos.sql — Sinérgica SO
-- Valida a FK criada NOT VALID em 0097 — transação separada, mesmo padrão de 0070/0071/0095/0096.

alter table pcm.locais validate constraint fk_locais_tipo_id;
