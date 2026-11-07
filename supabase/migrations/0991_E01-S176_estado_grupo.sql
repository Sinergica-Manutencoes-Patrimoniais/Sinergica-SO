-- ADR-0792: sem exclusão física ou alteração de programação.
create table pcm.sso_estado_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_estado_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_estado_grupo_gate enable row level security;
alter table pcm.sso_estado_grupo_gate force row level security;
revoke all on pcm.sso_estado_grupo_gate from public,anon,authenticated,service_role;
create function pcm.sso_alterar_estado_grupo(p_request_id uuid,p_grupo_id uuid,p_expected_revision integer,p_ativo boolean,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_antes pcm.grupos_quantitativos%rowtype;v_depois pcm.grupos_quantitativos%rowtype;v_cmd pcm.estrutura_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_motivo text:=btrim(p_motivo);
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not coalesce((select habilitado from pcm.sso_estado_grupo_gate where id),false) then raise exception 'estado_grupo_desabilitado' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_grupo_id is null or p_expected_revision is null or p_expected_revision<1 or p_ativo is null or v_motivo is null or length(v_motivo) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','estadoGrupo','grupoId',p_grupo_id,'expectedRevision',p_expected_revision,'ativo',p_ativo,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select g.* into v_antes from pcm.grupos_quantitativos g where g.id=p_grupo_id for update;
 if not found or config.sso_autorizar_acao('cadastro.gerir',v_antes.cliente_id) is not true then raise exception 'grupo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
 select c.* into v_cmd from pcm.estrutura_comandos c where c.request_id=p_request_id;
 if found then if v_cmd.actor_id is distinct from v_ator or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_cmd.resultado;end if;
 if v_antes.deleted_at is not null then raise exception 'grupo_excluido' using errcode='23514'; end if;
 if v_antes.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_antes.ativo=p_ativo then raise exception 'sem_alteracao' using errcode='23514'; end if;
 if p_ativo then
  perform 1 from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=v_antes.local_id and l.ativo and l.deleted_at is null and a.ativo and a.deleted_at is null and a.cliente_id=v_antes.cliente_id for share of l,a;
  if not found then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  perform 1 from pcm.equipamento_categorias c where c.id=v_antes.categoria_id and c.deleted_at is null for share;
  if not found then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  if v_antes.sistema_id is not null then
   perform 1 from pcm.sistemas s where s.id=v_antes.sistema_id and s.cliente_id=v_antes.cliente_id and s.ativo and s.deleted_at is null for share;
   if not found then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  end if;
 end if;
 update pcm.grupos_quantitativos set ativo=p_ativo,revisao=revisao+1,updated_at=now(),updated_by=v_ator where id=p_grupo_id returning * into v_depois;
 v_resultado:=jsonb_build_object('aggregateId',p_grupo_id,'revision',v_depois.revisao,'requestId',p_request_id,'ativo',p_ativo);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'grupo.atualizado','grupos_quantitativos',p_grupo_id,jsonb_build_object('operacao','estado','requestId',p_request_id,'motivo',v_motivo,'antes',to_jsonb(v_antes),'depois',to_jsonb(v_depois)));
 insert into pcm.estrutura_comandos(request_id,actor_id,payload,resultado) values(p_request_id,v_ator,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_alterar_estado_grupo(uuid,uuid,integer,boolean,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_alterar_estado_grupo(uuid,uuid,integer,boolean,text) to authenticated;
create function pcm.sso_listar_grupos_inativos(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,nome text,revisao integer,local_id uuid) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select gate.habilitado from pcm.sso_estado_grupo_gate gate where gate.id),false) then raise exception 'estado_grupo_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 return query select g.id,g.nome,g.revisao,g.local_id from pcm.grupos_quantitativos g where g.cliente_id=p_cliente_id and not g.ativo and g.deleted_at is null and (p_apos is null or g.id>p_apos) order by g.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_grupos_inativos(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_grupos_inativos(uuid,uuid,integer) to authenticated;
