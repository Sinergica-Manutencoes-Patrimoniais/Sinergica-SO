-- ADR-0285: leitura privada e desativada.
create table pcm.sso_breadcrumb_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_breadcrumb_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_breadcrumb_grupo_gate enable row level security;
alter table pcm.sso_breadcrumb_grupo_gate force row level security;
revoke all on pcm.sso_breadcrumb_grupo_gate from public,anon,authenticated,service_role;
create function pcm.sso_breadcrumb_grupo(p_grupo_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_id uuid;v_local pcm.locais%rowtype;v_area pcm.areas%rowtype;v_area_id uuid;
  v_visitados uuid[]:='{}'::uuid[];v_nomes text[]:='{}'::text[];v_n integer:=0;
begin
  if not coalesce((select habilitado from pcm.sso_breadcrumb_grupo_gate where id),false) then raise exception 'breadcrumb_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_grupo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select g.cliente_id,g.local_id into v_cliente,v_id from pcm.grupos_quantitativos g where g.id=p_grupo_id and g.ativo and g.deleted_at is null;
  if v_cliente is null or (config.sso_autorizar_acao('cadastro.ler',v_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true) then raise exception 'sem_acesso' using errcode='42501'; end if;
  while v_id is not null loop
    if v_n>=64 then return jsonb_build_object('grupoId',p_grupo_id,'estado','limite','caminho','[]'::jsonb); end if;
    if v_id=any(v_visitados) then return jsonb_build_object('grupoId',p_grupo_id,'estado','ciclo','caminho','[]'::jsonb); end if;
    v_visitados:=array_append(v_visitados,v_id);v_n:=v_n+1;
    select * into v_local from pcm.locais where id=v_id and ativo and deleted_at is null;
    if not found then return jsonb_build_object('grupoId',p_grupo_id,'estado','indisponivel','caminho','[]'::jsonb); end if;
    if v_area_id is null then v_area_id:=v_local.area_id; elsif v_area_id is distinct from v_local.area_id then return jsonb_build_object('grupoId',p_grupo_id,'estado','indisponivel','caminho','[]'::jsonb); end if;
    v_nomes:=array_prepend(v_local.nome,v_nomes);v_id:=v_local.parent_id;
  end loop;
  select * into v_area from pcm.areas where id=v_area_id and cliente_id=v_cliente and ativo and deleted_at is null;
  if not found then return jsonb_build_object('grupoId',p_grupo_id,'estado','indisponivel','caminho','[]'::jsonb); end if;
  return jsonb_build_object('grupoId',p_grupo_id,'estado','disponivel','caminho',to_jsonb(array_prepend(v_area.nome,v_nomes)));
end;
$$;
revoke all on function pcm.sso_breadcrumb_grupo(uuid) from public,anon,authenticated,service_role;
