-- ADR-0290: diagnóstico agregado por página, privado e desligado.
create table pcm.sso_diagnostico_ancestrais_grupos_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_ancestrais_grupos_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_ancestrais_grupos_gate enable row level security;
alter table pcm.sso_diagnostico_ancestrais_grupos_gate force row level security;
revoke all on pcm.sso_diagnostico_ancestrais_grupos_gate from public,anon,authenticated,service_role;
create function pcm.sso_diagnostico_ancestrais_grupos(p_cliente_id uuid,p_apos uuid,p_limite integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_grupo record;v_id uuid;v_local pcm.locais%rowtype;v_area_id uuid;v_visitados uuid[];v_n integer;v_estado text;
  v_total integer:=0;v_ciclos integer:=0;v_incompletos integer:=0;v_limite integer:=0;v_ultimo uuid;
begin
  if not coalesce((select habilitado from pcm.sso_diagnostico_ancestrais_grupos_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  for v_grupo in select g.id,g.local_id from pcm.grupos_quantitativos g where g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null and (p_apos is null or g.id>p_apos) order by g.id limit p_limite loop
    v_total:=v_total+1;v_ultimo:=v_grupo.id;v_id:=v_grupo.local_id;v_area_id:=null;v_visitados:='{}'::uuid[];v_n:=0;v_estado:='ok';
    while v_id is not null loop
      if v_n>=64 then v_estado:='limite';exit; end if;
      if v_id=any(v_visitados) then v_estado:='ciclo';exit; end if;
      v_visitados:=array_append(v_visitados,v_id);v_n:=v_n+1;
      select * into v_local from pcm.locais where id=v_id and ativo and deleted_at is null;
      if not found then v_estado:='incompleto';exit; end if;
      if v_area_id is null then v_area_id:=v_local.area_id; elsif v_area_id is distinct from v_local.area_id then v_estado:='incompleto';exit; end if;
      v_id:=v_local.parent_id;
    end loop;
    if v_estado='ok' and not exists(select 1 from pcm.areas a where a.id=v_area_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null) then v_estado:='incompleto'; end if;
    if v_estado='ciclo' then v_ciclos:=v_ciclos+1;elsif v_estado='incompleto' then v_incompletos:=v_incompletos+1;elsif v_estado='limite' then v_limite:=v_limite+1; end if;
  end loop;
  return jsonb_build_object('clienteId',p_cliente_id,'examinados',v_total,'ciclos',v_ciclos,'incompletos',v_incompletos,'limite',v_limite,'ultimoId',v_ultimo);
end;
$$;
revoke all on function pcm.sso_diagnostico_ancestrais_grupos(uuid,uuid,integer) from public,anon,authenticated,service_role;
