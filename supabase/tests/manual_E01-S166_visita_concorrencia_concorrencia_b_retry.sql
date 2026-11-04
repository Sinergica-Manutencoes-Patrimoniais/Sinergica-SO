begin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
do $$ declare r jsonb;begin r:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000193','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000194','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000081',1,'fonte teste');if r->>'criada' is distinct from 'false' then raise exception 'deveria_reutilizar: %',r;end if;end; $$;
reset role;do $$ begin if (select count(*) from pcm.ocorrencias_visita_preparadas where plano_id='16610000-0000-0000-0000-000000000121')<>1 then raise exception 'visita_duplicada';end if;end; $$;
rollback;
