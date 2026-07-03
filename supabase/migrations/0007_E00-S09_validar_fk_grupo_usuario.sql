-- 0007_E00-S09_validar_fk_grupo_usuario.sql — Sinérgica SO
-- Completa 0006: valida a FK `usuarios_grupo_id_fkey` numa transação separada, seguindo o
-- padrão já usado em 0005 para evitar table-scan lock desnecessário apontado pelo Squawk.
--
-- Reverso: nenhum — validar uma FK não é uma mudança reversível de schema por si só
-- (o reverso real é `alter table config.usuarios drop constraint usuarios_grupo_id_fkey`,
-- documentado em 0006).

alter table config.usuarios validate constraint usuarios_grupo_id_fkey;
