-- ADR-0210: operações privadas e gate fechado.
create table pcm.sso_observacao_material_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_observacao_material_gate(id,habilitado) values(true,false);
create table pcm.sso_material_observacoes(id uuid primary key default gen_random_uuid(),lista_id uuid not null references pcm.listas_materiais(id),
  evento_revision integer not null,lista_revision integer not null, texto text not null check(length(btrim(texto)) between 1 and 2000),
  ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),
  foreign key(lista_id,evento_revision) references pcm.sso_lista_materiais_eventos(lista_id,revisao),unique(lista_id,lista_revision));
alter table pcm.sso_observacao_material_gate enable row level security;
alter table pcm.sso_observacao_material_gate force row level security;
alter table pcm.sso_material_observacoes enable row level security;
alter table pcm.sso_material_observacoes force row level security;
revoke all on pcm.sso_observacao_material_gate,pcm.sso_material_observacoes from public,anon,authenticated,service_role;
create function pcm.sso_observacao_material_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514';end; $$;
revoke all on function pcm.sso_observacao_material_imutavel() from public,anon,authenticated,service_role;
create trigger sso_observacao_material_imutavel before update or delete on pcm.sso_material_observacoes for each row execute function pcm.sso_observacao_material_imutavel();
create function pcm.sso_anotar_excecao_material(p_request_id uuid,p_lista_id uuid,p_expected_revision integer,p_evento_revision integer,p_texto text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lista pcm.listas_materiais%rowtype;v_existente pcm.sso_material_observacoes%rowtype;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_observacao_material_gate where id),false) then raise exception 'observacao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lista_id is null or p_expected_revision is null or p_expected_revision<1 or p_evento_revision is null or p_evento_revision<1 or p_texto is null or length(btrim(p_texto)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('observacao-material:'||p_request_id::text,0));
  select * into v_lista from pcm.listas_materiais where id=p_lista_id for update;
  if not found or config.sso_autorizar_acao('material.gerir',v_lista.cliente_id) is not true or not exists(select 1 from pcm.ordens_servico o where o.id=v_lista.ordem_servico_id and o.client_id=v_lista.cliente_id and o.deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_existente from pcm.sso_material_observacoes where request_id=p_request_id;
  if found then
    if v_existente.ator_id is distinct from v_ator or v_existente.lista_id is distinct from p_lista_id or v_existente.lista_revision<>p_expected_revision+1 or v_existente.evento_revision<>p_evento_revision or v_existente.texto is distinct from btrim(p_texto) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('listaId',p_lista_id,'eventoRevision',p_evento_revision,'revision',v_existente.lista_revision,'requestId',p_request_id);
  end if;
  if v_lista.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from pcm.sso_lista_materiais_eventos e where e.lista_id=p_lista_id and e.revisao=p_evento_revision and e.tipo='excecao') then raise exception 'excecao_indisponivel' using errcode='23514'; end if;
  update pcm.listas_materiais set revisao=revisao+1 where id=p_lista_id returning * into v_lista;
  insert into pcm.sso_material_observacoes(lista_id,evento_revision,lista_revision,texto,ator_id,request_id) values(p_lista_id,p_evento_revision,v_lista.revisao,btrim(p_texto),v_ator,p_request_id);
  v_resultado:=jsonb_build_object('listaId',p_lista_id,'eventoRevision',p_evento_revision,'revision',v_lista.revisao,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'material.excecao_observada','listas_materiais',p_lista_id,v_resultado||jsonb_build_object('clienteId',v_lista.cliente_id));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_anotar_excecao_material(uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
create function pcm.sso_listar_observacoes_excecao_material(p_lista_id uuid,p_evento_revision integer,p_apos integer,p_limite integer)
returns table(lista_revision integer,texto text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if p_lista_id is null or p_evento_revision is null or p_evento_revision<1 or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select l.cliente_id into v_cliente from pcm.listas_materiais l join pcm.ordens_servico o on o.id=l.ordem_servico_id and o.client_id=l.cliente_id and o.deleted_at is null where l.id=p_lista_id;
  if not found or config.sso_autorizar_acao('material.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select s.lista_revision,s.texto,s.ator_id,s.criado_em from pcm.sso_material_observacoes s where s.lista_id=p_lista_id and s.evento_revision=p_evento_revision and (p_apos is null or s.lista_revision>p_apos) order by s.lista_revision limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_observacoes_excecao_material(uuid,integer,integer,integer) from public,anon,authenticated,service_role;
