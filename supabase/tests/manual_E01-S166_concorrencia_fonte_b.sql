begin;
set local timezone='UTC';
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
do $$ begin begin perform pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000064','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date);raise exception 'origem_concorrente_aceita';exception when lock_not_available then null;end;end; $$;
rollback;
