begin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
do $$ begin begin perform pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000195','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000196','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000081',1,'fonte teste');raise exception 'fotografia_obsoleta_aceita';exception when check_violation then if sqlerrm<>'pmoc_mesma_data_exige_conferencia' then raise;end if;end;end; $$;
rollback;
