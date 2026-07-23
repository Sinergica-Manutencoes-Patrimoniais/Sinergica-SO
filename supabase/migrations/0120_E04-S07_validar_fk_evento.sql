-- 0120_E04-S07_validar_fk_evento.sql
-- Valida a FK criada NOT VALID em 0119 (padrão split — não bloqueia a tabela com lock forte).

alter table financeiro.lancamentos_eventos
  validate constraint lancamentos_eventos_lancamento_id_fkey;
