-- 0218_E01-S155_validar_fk_posicao.sql
-- Valida as FKs criadas NOT VALID em 0217 (padrão 0073/0074/0095/0096) — checa as linhas
-- existentes sem bloquear escrita durante a criação da constraint.
--
-- Reverso: não aplicável (VALIDATE não é reversível; a FK em si reverte junto com 0217).

alter table pcm.equipamentos validate constraint fk_equipamentos_area;
alter table pcm.sistemas validate constraint fk_sistemas_local;
