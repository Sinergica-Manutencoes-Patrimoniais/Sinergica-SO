-- 0064_E02-S21_validar_tipo_conteudo.sql — valida check criado sem lock longo.
-- Reverso: não aplicável; a constraint reverte em 0063.
alter table atendimento.mensagens validate constraint mensagens_tipo_conteudo_check;
