-- 0222_E01-S157_validar_siglas_identificador_ativo.sql
-- Valida os CHECKs adicionados sem varrer nem bloquear escrita durante a expansão de 0221.
-- Reverso: não aplicável (VALIDATE não é reversível; as constraints revertem com 0221).

alter table pcm.clientes validate constraint ck_clientes_sigla;
alter table pcm.areas validate constraint ck_areas_sigla;
alter table pcm.locais validate constraint ck_locais_sigla;
