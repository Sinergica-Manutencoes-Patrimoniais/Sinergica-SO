-- 0096_E01-S76_validar_constraints_hierarquia.sql — Sinérgica SO
-- Valida as 3 constraints criadas NOT VALID em 0095 — transação separada, mesmo padrão de
-- 0005/0007/0045/0071.

alter table pcm.equipamentos validate constraint chk_equipamentos_tipo;
alter table pcm.equipamentos validate constraint fk_equipamentos_local;
alter table pcm.equipamentos validate constraint fk_equipamentos_parent;
