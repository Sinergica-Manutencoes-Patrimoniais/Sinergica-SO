-- 0119_E04-S07_fk_evento_delete_set_null.sql
-- Bug encontrado via Playwright: estornarLancamentoRealizado insere o evento de auditoria e DEPOIS
-- apaga o lançamento (AC-2, "auditoria antes de apagar") — mas a FK de lancamentos_eventos.lancamento_id
-- criada em 0117 era `not null references financeiro.lancamentos (id)` sem ON DELETE, então o DELETE
-- do lançamento sempre falhava com violação de FK (23503) quando já existia qualquer evento
-- referenciando-o (o próprio evento de estorno recém-inserido já bastava). O objetivo do evento é
-- sobreviver à exclusão do lançamento (é o registro histórico de que ele existiu e foi apagado), então
-- a FK precisa ser ON DELETE SET NULL — a coluna vira opcional.
-- NOT VALID aqui; VALIDATE em 0120 (padrão split da casa, ver 0101/0102).
-- Reverso:
--   alter table financeiro.lancamentos_eventos drop constraint lancamentos_eventos_lancamento_id_fkey;
--   alter table financeiro.lancamentos_eventos alter column lancamento_id set not null;
--   alter table financeiro.lancamentos_eventos add constraint lancamentos_eventos_lancamento_id_fkey foreign key (lancamento_id) references financeiro.lancamentos (id);

alter table financeiro.lancamentos_eventos drop constraint lancamentos_eventos_lancamento_id_fkey;
-- Intencional: vira null quando o ON DELETE SET NULL dispara (lançamento apagado); nenhum client
-- depende de lancamento_id ser sempre preenchido — é auditoria, sobrevive à exclusão do dado que descreve.
-- squawk-ignore ban-drop-not-null
alter table financeiro.lancamentos_eventos alter column lancamento_id drop not null;
alter table financeiro.lancamentos_eventos
  add constraint lancamentos_eventos_lancamento_id_fkey
  foreign key (lancamento_id) references financeiro.lancamentos (id) on delete set null
  not valid;
