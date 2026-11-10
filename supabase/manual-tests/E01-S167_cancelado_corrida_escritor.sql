begin;
set local app.auvo_sync_write='true';
update pcm.ordens_servico set status='em_execucao' where id='16795001-0000-4000-8000-000000000022';
select pg_sleep(4);
commit;
