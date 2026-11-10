-- Clone descartável, executar em BEGIN/ROLLBACK; nenhuma integração externa.
\ir manual_E01-S165_impacto_calendario_nativo_1704.sql
reset role;
update pcm.sso_diagnostico_revisao_mediado_gate set habilitado=true where id;
update pcm.sso_precondicao_impacto_mediado_gate set habilitado=true where id;
update pcm.sso_precondicao_impacto_gate set habilitado=true where id;
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
update pcm.sso_guardar_impacto_aprovacao_gate set habilitado=true where id;
update pcm.sso_avaliacao_impacto_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_impacto_revisao_gate set habilitado=true where id;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 begin perform pcm.sso_preflight_revisao_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1,current_date+1); raise exception 'diagnostico_aceitou_revisao'; exception when sqlstate 'P0011' then null;end;
 begin perform pcm.sso_registrar_precondicao_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000909','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1,current_date+1); raise exception 'precondicao_aceitou_revisao'; exception when sqlstate 'P0011' then null;end;
 a:=pcm.sso_registrar_precondicao_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000909','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,current_date+1);
 b:=pcm.sso_registrar_precondicao_impacto_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000909','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,current_date+1);
 if a is distinct from b then raise exception 'replay_divergente';end if;
end $$;
