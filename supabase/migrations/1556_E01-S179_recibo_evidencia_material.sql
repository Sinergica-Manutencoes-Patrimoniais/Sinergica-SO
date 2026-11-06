-- ADR-1412: leitura do recibo sem reexecutar upload nem expor objeto privado.
create table pcm.sso_recibo_evidencia_material_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_recibo_evidencia_material_gate(id,habilitado) values(true,false);
alter table pcm.sso_recibo_evidencia_material_gate enable row level security;
alter table pcm.sso_recibo_evidencia_material_gate force row level security;
revoke all on pcm.sso_recibo_evidencia_material_gate from public,anon,authenticated,service_role;

create function pcm.sso_consultar_recibo_evidencia_material(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_evento_revision integer,p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_cmd pcm.sso_material_evidencia_comandos%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_request_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_recibo_evidencia_material_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_material_evidencia_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('material-evidencia:'||p_request_id::text,0));
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_cmd from pcm.sso_material_evidencia_comandos where request_id=p_request_id;
 if not found then return jsonb_build_object('requestId',p_request_id,'estado','nao_localizado'); end if;
 if v_cmd.ator_id is distinct from p_ator_id or v_cmd.cliente_id is distinct from p_cliente_id
   or v_cmd.payload->>'listaId' is distinct from p_lista_id::text
   or v_cmd.payload->>'eventoRevision' is distinct from p_evento_revision::text then raise exception 'sem_acesso' using errcode='42501'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('requestId',p_request_id,'estado','vinculada','evidenciaId',v_cmd.resultado->>'evidenciaId','listaId',p_lista_id,'eventoRevision',p_evento_revision);
end; $$;
revoke all on function pcm.sso_consultar_recibo_evidencia_material(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_recibo_evidencia_material(uuid,uuid,uuid,integer,uuid) to authenticated;
