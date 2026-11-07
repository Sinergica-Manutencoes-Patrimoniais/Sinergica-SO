begin;
update pcm.chamados set ordem_servico_id='16795001-0000-4000-8000-000000000024' where id='16795001-0000-4000-8000-000000000011';
select pg_sleep(4);
commit;
