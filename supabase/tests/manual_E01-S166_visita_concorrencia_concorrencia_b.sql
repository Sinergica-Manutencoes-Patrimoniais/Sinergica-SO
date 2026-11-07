begin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
set local lock_timeout='1s';
do $$ begin begin perform pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000193','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000194','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000081',1,'fonte teste');raise exception 'concorrencia_indevidamente_aceita';exception when lock_not_available then null;end;end; $$;
rollback;
