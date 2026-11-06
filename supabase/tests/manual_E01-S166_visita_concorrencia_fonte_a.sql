begin;
set local application_name='sso-visita-fonte-a';
update pcm.pmoc_schedules set status='atrasado' where id='16610000-0000-0000-0000-000000000152';
select pg_sleep(20);
commit;
