-- 0220_E01-S156_validar_fk_categoria.sql
alter table pcm.equipamento_categorias validate constraint ck_equipamento_categorias_sigla;
alter table pcm.equipamentos validate constraint fk_equipamentos_categoria;
alter table pcm.sistemas validate constraint fk_sistemas_categoria;
