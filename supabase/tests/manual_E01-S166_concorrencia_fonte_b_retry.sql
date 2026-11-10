begin;
set local timezone='UTC';
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
do $$ begin begin perform pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000064','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date);raise exception 'fotografia_obsoleta_aceita';exception when check_violation then if sqlerrm<>'origem_lote_exige_reconciliacao' then raise;end if;end;end; $$;
rollback;
