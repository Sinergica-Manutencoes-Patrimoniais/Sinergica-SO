-- 0099_E01-S77_jornada_diaria_funcionarios.sql — Sinérgica SO
-- Adiciona a jornada diária esperada (em horas) ao funcionário, para a visão diária de apontamento
-- de horas (E01-S77) sinalizar falta / hora-extra contra o span do dia. Coluna aditiva, nullable:
-- funcionário sem jornada cadastrada nunca é sinalizado (default seguro, AC-6). Dado 100% local do
-- PCM — não vai ao Auvo (o descriptor `funcionarios`/`/users` não mapeia este campo).
--
-- Reverso:
--   alter table pcm.funcionarios drop column if exists jornada_diaria_horas;

alter table pcm.funcionarios add column if not exists jornada_diaria_horas numeric;

comment on column pcm.funcionarios.jornada_diaria_horas is
  'Jornada diária esperada em horas (E01-S77). Nullable = sem sinalização de falta/hora-extra.';
