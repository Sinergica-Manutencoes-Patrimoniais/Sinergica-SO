begin;
set local lock_timeout='1s';
do $$ begin begin update pcm.pmoc_schedules set status='atrasado' where id='16610000-0000-0000-0000-000000000152';raise exception 'alteracao_concorrente_aceita';exception when lock_not_available then null;end;end; $$;
rollback;
