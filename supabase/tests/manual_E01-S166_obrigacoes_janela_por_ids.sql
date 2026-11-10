-- Executar com migrations até 1670 em clone sintético e transação revertida.
\ir manual_E01-S166_pmoc_lote.sql
update pcm.sso_obrigacoes_preparadas_mediadas_gate set habilitado=true where id;
update pcm.sso_fila_obrigacoes_preparadas_gate set habilitado=true where id;
create temporary table sso_ids_janela as select array_agg(id order by id) ids from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011';
grant select on sso_ids_janela to authenticated;
set local role authenticated;
do $$ declare ids uuid[]; begin
 select t.ids into ids from sso_ids_janela t;
 if cardinality(ids)<>2 then raise exception 'fixture_incompleta';end if;
 if (select count(*) from pcm.sso_obrigacoes_calendario_por_ids('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',ids))<>2 then raise exception 'consulta_incompleta';end if;
 begin perform * from pcm.sso_obrigacoes_calendario_por_ids('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',array[ids[1],ids[1]]);raise exception 'duplicata_aceita';exception when invalid_parameter_value then null;end;
 begin perform * from pcm.sso_obrigacoes_calendario_por_ids('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',array[ids[1],'16630000-1111-4000-8000-000000000099'::uuid]);raise exception 'ausente_aceita';exception when insufficient_privilege then null;end;
 begin perform * from pcm.sso_obrigacoes_calendario_por_ids('16630000-1111-4000-8000-00000000000b','16630000-1111-4000-8000-000000000011',ids);raise exception 'outro_cliente_aceito';exception when insufficient_privilege then null;end;
 begin perform * from pcm.sso_obrigacoes_calendario_por_ids('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',array(select gen_random_uuid() from generate_series(1,776)));raise exception 'limite_ignorado';exception when invalid_parameter_value then null;end;
end; $$;
reset role;
update config.sso_concessoes set ativa=false where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ begin begin perform * from pcm.sso_obrigacoes_calendario_por_ids('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',(select ids from sso_ids_janela));raise exception 'revogacao_ignorada';exception when insufficient_privilege then null;end;end; $$;
reset role;
do $$ begin if has_function_privilege('anon','pcm.sso_obrigacoes_calendario_por_ids(uuid,uuid,uuid[])','execute') then raise exception 'acl_anon_indevida';end if;end; $$;
