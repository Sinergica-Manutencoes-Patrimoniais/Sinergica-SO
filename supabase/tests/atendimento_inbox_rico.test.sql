-- atendimento_inbox_rico.test.sql — pgTAP E02-S21.
begin;
select plan(5);
select has_column('atendimento', 'mensagens', 'midia_url', 'mensagem guarda caminho da midia');
select has_column('atendimento', 'mensagens', 'midia_mime', 'mensagem guarda MIME');
select has_column('atendimento', 'mensagens', 'payload', 'mensagem guarda payload estruturado');
select ok(exists(select 1 from storage.buckets where id = 'atendimento-midias'), 'bucket privado existe');
select is((select public from storage.buckets where id = 'atendimento-midias'), false, 'bucket nao e publico');
select * from finish();
rollback;
