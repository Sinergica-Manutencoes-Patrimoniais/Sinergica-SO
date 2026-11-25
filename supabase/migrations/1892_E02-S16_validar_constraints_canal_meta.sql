-- 1892_E02-S16_validar_constraints_canal_meta.sql — Sinérgica SO
-- Validação separada dos CHECKs adicionados como NOT VALID na 1890. Em transação própria porque
-- `ADD ... NOT VALID` + `VALIDATE` no mesmo arquivo bloqueia leitura da tabela durante a varredura
-- (Squawk: constraint-missing-not-valid) — `canais_externos` é lida no caminho do webhook.
--
-- Reverso:
--   alter table atendimento.canais_externos
--     drop constraint if exists canais_externos_verify_token_sem_segredo,
--     drop constraint if exists canais_externos_provedor_valido;

alter table atendimento.canais_externos validate constraint canais_externos_provedor_valido;
alter table atendimento.canais_externos validate constraint canais_externos_verify_token_sem_segredo;
