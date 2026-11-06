begin;
set local application_name='sso-s166-fonte-a';
update pcm.pmoc_schedules set status='atrasado' where id='16630000-1111-4000-8000-000000000043';
select pg_sleep(20);
commit;
