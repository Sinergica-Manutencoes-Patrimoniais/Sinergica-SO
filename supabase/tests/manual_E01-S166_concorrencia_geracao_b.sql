begin;
set local lock_timeout='1s';
do $$ begin begin update pcm.pmoc_schedules set status='atrasado' where id='16630000-1111-4000-8000-000000000043';raise exception 'alteracao_concorrente_aceita';exception when lock_not_available then null;end;end; $$;
rollback;
