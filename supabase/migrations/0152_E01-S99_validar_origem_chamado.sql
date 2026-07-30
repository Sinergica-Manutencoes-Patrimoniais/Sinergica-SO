-- 0152_E01-S99_validar_origem_chamado.sql — Sinérgica SO
-- Valida o constraint adicionado em 0151 (NOT VALID lá, VALIDATE aqui — padrão da casa, ver
-- 0134/0135).

alter table pcm.chamados
  validate constraint chamados_origem_check;
