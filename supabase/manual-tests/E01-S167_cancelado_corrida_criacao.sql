begin;
set local app.auvo_sync_write='true';
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,created_by,chamado_id) values ('16795001-0000-4000-8000-000000000023','16795001-0000-4000-8000-00000000000a','ignorado','OS nova sintética','corretiva','em_execucao','16795001-0000-4000-8000-000000000001','16795001-0000-4000-8000-000000000011');
select pg_sleep(4);
commit;
