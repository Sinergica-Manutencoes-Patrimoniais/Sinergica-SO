-- 0082_E01-S47_funcionarios_user_type_auvo.sql — Sinérgica SO
-- A Auvo retorna IDs de tipo de usuário além de 1..3 (ex.: 4 para Eng. Eletricista).
-- `user_type` é um identificador do catálogo externo, não uma enumeração fechada do PCM.

alter table pcm.funcionarios
  drop constraint if exists funcionarios_user_type_check;

alter table pcm.funcionarios
  add constraint funcionarios_user_type_check
  check (user_type > 0) not valid;

-- Reverso:
-- alter table pcm.funcionarios drop constraint if exists funcionarios_user_type_check;
-- alter table pcm.funcionarios add constraint funcionarios_user_type_check check (user_type in (1, 2, 3));
