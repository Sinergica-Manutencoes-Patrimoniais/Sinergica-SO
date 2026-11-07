begin;
set local timezone='UTC';
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
do $$ declare r jsonb;begin r:=pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000062','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,current_date);if r->>'criada' is distinct from 'false' then raise exception 'replay_deveria_reutilizar: %',r;end if;end; $$;
reset role;
do $$ begin if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'concorrencia_duplicou_ciclo';end if;end; $$;
rollback;
