-- Clone com BEGIN/ROLLBACK; fixture histórica cria vínculo real mediado.
\ir manual_E01-S165_S166_ponte_legada_mediada.sql
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
create temp table ponte1718 as select ocorrencia_preparada_id id from pcm.ocorrencias_rotina_vinculos limit 1;
grant select on ponte1718 to authenticated;
set local role authenticated;
do $$ begin
 if not exists(select 1 from pcm.sso_listar_ciclos_reserva_legado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','calendario',null,50) l join ponte1718 p on p.id=l.preparada_id) then raise exception 'preparada_vinculada_ausente';end if;
 begin perform * from pcm.sso_listar_ciclos_reserva_legado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','calendario',null,51);raise exception 'limite_nao_validado';exception when invalid_parameter_value then null;end;
end; $$;
reset role;
do $$ begin if has_function_privilege('anon','pcm.sso_listar_ciclos_reserva_legado(uuid,uuid,uuid,text,uuid,integer)','execute') then raise exception 'acl_anon_indevida';end if;end; $$;
