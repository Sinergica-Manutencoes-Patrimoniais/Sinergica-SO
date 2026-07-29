-- 0162_E01-S111_validar_preferencia_contato.sql — Sinérgica SO
-- Valida o constraint adicionado em 0161 (NOT VALID lá, VALIDATE aqui — padrão da casa, ver
-- 0151/0152).

alter table pcm.cliente_responsaveis
  validate constraint cliente_responsaveis_preferencia_contato_check;
