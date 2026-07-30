-- 0163_E01-S112_agenda_tecnico_hora_inicio_fim.sql — Sinérgica SO
-- Story E01-S112. Estende E01-S104 (migration 0155): `agenda_tecnico.hora` (horário pontual) vira
-- `hora_inicio` + `hora_fim` (intervalo) — Lucas pediu início/fim, não só um horário.
--
-- Reverso:
--   alter table pcm.agenda_tecnico drop column if exists hora_fim;
--   alter table pcm.agenda_tecnico rename column hora_inicio to hora;

-- Intencional: nenhum client em produção lê `hora` fora do adapter deste mesmo PR/deploy; dado
-- preservado (rename, não drop).
-- squawk-ignore renaming-column
alter table pcm.agenda_tecnico rename column hora to hora_inicio;
alter table pcm.agenda_tecnico add column hora_fim time;
