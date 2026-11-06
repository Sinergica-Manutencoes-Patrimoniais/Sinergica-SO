-- ADR-0342: eventos append-only de visibilidade da versão já publicada.
create table pcm.portal_material_visibilidade_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.portal_material_visibilidade_gate(id,habilitado) values(true,false);
alter table pcm.portal_material_visibilidade_gate enable row level security;
alter table pcm.portal_material_visibilidade_gate force row level security;
revoke all on pcm.portal_material_visibilidade_gate from public,anon,authenticated,service_role;
create table pcm.portal_material_visibilidade_eventos(
  lista_id uuid not null,revisao_publicacao integer not null,sequencia integer not null check(sequencia>0),acao text not null check(acao in ('retirar','republicar')),
  motivo text not null check(length(btrim(motivo)) between 1 and 1000),request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  primary key(lista_id,revisao_publicacao,sequencia),foreign key(lista_id,revisao_publicacao) references pcm.sso_portal_materiais_publicacoes(lista_id,revisao_lista)
);
alter table pcm.portal_material_visibilidade_eventos enable row level security;
alter table pcm.portal_material_visibilidade_eventos force row level security;
revoke all on pcm.portal_material_visibilidade_eventos from public,anon,authenticated,service_role;
create function pcm.sso_portal_material_visibilidade(p_request_id uuid,p_lista_id uuid,p_revisao_publicacao integer,p_acao text,p_motivo text)
returns integer language plpgsql security definer set search_path='' as $$
declare l pcm.listas_materiais%rowtype; anterior pcm.portal_material_visibilidade_eventos%rowtype; v_ultima text; v_seq integer;
begin
  if auth.uid() is null or p_request_id is null or p_lista_id is null or p_revisao_publicacao is null or p_revisao_publicacao<1
    or p_acao is null or p_acao not in ('retirar','republicar') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from pcm.portal_material_visibilidade_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('material-visibilidade:'||p_request_id::text,0));
  select * into l from pcm.listas_materiais where id=p_lista_id for update;
  if not found or config.sso_autorizar_acao('material.gerir',l.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from pcm.portal_material_visibilidade_eventos where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.lista_id<>p_lista_id or anterior.revisao_publicacao<>p_revisao_publicacao or anterior.acao<>p_acao or anterior.motivo<>btrim(p_motivo)
      then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.sequencia;
  end if;
  if not exists(select 1 from pcm.sso_portal_materiais_publicacoes p where p.lista_id=l.id and p.revisao_lista=p_revisao_publicacao)
    or p_revisao_publicacao is distinct from (select max(p.revisao_lista) from pcm.sso_portal_materiais_publicacoes p where p.lista_id=l.id)
    or p_revisao_publicacao<coalesce((select max(v.revisao) from pcm.sso_lista_materiais_versoes v where v.lista_id=l.id),1)
    then raise exception 'publicacao_obsoleta' using errcode='40001'; end if;
  select e.acao,e.sequencia into v_ultima,v_seq from pcm.portal_material_visibilidade_eventos e where e.lista_id=l.id and e.revisao_publicacao=p_revisao_publicacao order by e.sequencia desc limit 1;
  if (p_acao='retirar' and v_ultima='retirar') or (p_acao='republicar' and coalesce(v_ultima,'publicar')<>'retirar') then raise exception 'visibilidade_invalida' using errcode='23514'; end if;
  v_seq:=coalesce(v_seq,0)+1;
  insert into pcm.portal_material_visibilidade_eventos(lista_id,revisao_publicacao,sequencia,acao,motivo,request_id,ator_id) values(l.id,p_revisao_publicacao,v_seq,p_acao,btrim(p_motivo),p_request_id,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'material.portal_'||p_acao,'listas_materiais',l.id,jsonb_build_object('requestId',p_request_id,'clienteId',l.cliente_id,'revisaoPublicacao',p_revisao_publicacao,'sequencia',v_seq));
  return v_seq;
end $$;
revoke all on function pcm.sso_portal_material_visibilidade(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_historico_visibilidade_materiais(p_cliente_id uuid,p_lista_id uuid,p_apos integer default 0)
returns table(revisao_publicacao integer,sequencia integer,acao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_apos is null or p_apos<0 or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id)
    or not coalesce((select habilitado from pcm.portal_material_visibilidade_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select e.revisao_publicacao,e.sequencia,e.acao,e.motivo,e.ator_id,e.criado_em from pcm.portal_material_visibilidade_eventos e
    where e.lista_id=p_lista_id and e.revisao_publicacao=(select max(p.revisao_lista) from pcm.sso_portal_materiais_publicacoes p where p.lista_id=p_lista_id)
      and e.sequencia>p_apos order by e.sequencia limit 20;
end $$;
revoke all on function pcm.sso_historico_visibilidade_materiais(uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_status_publicacao_materiais(p_cliente_id uuid,p_lista_id uuid)
returns table(revisao_publicacao integer,situacao text,aplicavel boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.listas_materiais l where l.id=p_lista_id and l.cliente_id=p_cliente_id)
    or not coalesce((select habilitado from pcm.portal_material_visibilidade_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.revisao_lista,coalesce((select e.acao from pcm.portal_material_visibilidade_eventos e where e.lista_id=p.lista_id and e.revisao_publicacao=p.revisao_lista order by e.sequencia desc limit 1),'publicar'),
    p.revisao_lista>=coalesce((select max(v.revisao) from pcm.sso_lista_materiais_versoes v where v.lista_id=p.lista_id),1)
    from pcm.sso_portal_materiais_publicacoes p where p.lista_id=p_lista_id order by p.revisao_lista desc limit 1;
end $$;
revoke all on function pcm.sso_status_publicacao_materiais(uuid,uuid) from public,anon,authenticated,service_role;

-- Atualização após criar as dependências; preserva assinaturas e concessões.
create or replace function pcm.sso_portal_listar_materiais(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(id uuid, ordem_servico_id uuid, responsavel text, estado text, revisao integer,
  linhas jsonb, publicado_em timestamptz, ultima_informacao_em timestamptz, ultima_informacao_por uuid,
  excecao_atual boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico'
  ) or not exists (select 1 from pcm.ordens_servico o where o.id = p_os_id
    and o.client_id = p_cliente_id and o.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select l.id, l.ordem_servico_id, l.responsavel, l.estado, l.revisao,
    p.linhas, p.publicado_em, ev.criado_em, ev.ator_id, coalesce(ex.tipo = 'excecao', false)
    from pcm.listas_materiais l join lateral (select pub.* from pcm.sso_portal_materiais_publicacoes pub
      where pub.lista_id = l.id and pub.revisao_lista >= coalesce((select max(v.revisao)
        from pcm.sso_lista_materiais_versoes v where v.lista_id = l.id), 1)
      order by pub.revisao_lista desc limit 1) p on true
    left join lateral (select e.criado_em, e.ator_id from pcm.sso_lista_materiais_eventos e
      where e.lista_id = l.id and e.tipo = 'disponibilidade' order by e.revisao desc limit 1) ev on true
    left join lateral (select e.tipo from pcm.sso_lista_materiais_eventos e
      where e.lista_id = l.id order by e.revisao desc limit 1) ex on true
    where l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id and (p_apos is null or l.id > p_apos)
      and (not coalesce((select habilitado from pcm.portal_material_visibilidade_gate where pcm.portal_material_visibilidade_gate.id),false)
        or coalesce((select e.acao from pcm.portal_material_visibilidade_eventos e where e.lista_id=l.id and e.revisao_publicacao=p.revisao_lista order by e.sequencia desc limit 1),'publicar') <> 'retirar')
    order by l.id limit 20;
end;
$$;

create or replace function pcm.sso_portal_informar_material(p_request_id uuid, p_lista_id uuid,
  p_expected_revision integer, p_situacao text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_comando pcm.sso_portal_materiais_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_lista_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_situacao is null
    or p_situacao not in ('informada_disponivel', 'parcial', 'indisponivel') then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-material:' || p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found or v_lista.responsavel <> 'cliente' or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = v_lista.cliente_id and u.ativo and u.papel = 'cliente-sindico'
  ) or not exists (select 1 from pcm.sso_portal_materiais_publicacoes p where p.lista_id = p_lista_id
    and p.revisao_lista = (select max(ultima.revisao_lista) from pcm.sso_portal_materiais_publicacoes ultima where ultima.lista_id=p_lista_id)
    and p.revisao_lista >= coalesce((select max(v.revisao) from pcm.sso_lista_materiais_versoes v where v.lista_id = p_lista_id), 1)
    and (not coalesce((select habilitado from pcm.portal_material_visibilidade_gate where id),false)
      or coalesce((select e.acao from pcm.portal_material_visibilidade_eventos e where e.lista_id=p.lista_id and e.revisao_publicacao=p.revisao_lista order by e.sequencia desc limit 1),'publicar') <> 'retirar'))
    or not exists (select 1 from pcm.ordens_servico o where o.id = v_lista.ordem_servico_id
      and o.client_id = v_lista.cliente_id and o.deleted_at is null) then
    raise exception 'lista_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'informar', 'listaId', p_lista_id,
    'expectedRevision', p_expected_revision, 'situacao', p_situacao);
  select * into v_comando from pcm.sso_portal_materiais_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_lista.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  update pcm.listas_materiais set estado = p_situacao, revisao = revisao + 1
    where id = p_lista_id returning * into v_lista;
  insert into pcm.sso_lista_materiais_eventos(lista_id, revisao, tipo, dados, ator_id)
    values (p_lista_id, v_lista.revisao, 'disponibilidade', jsonb_build_object('situacao', p_situacao), auth.uid());
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'material.disponibilidade_portal', 'listas_materiais', p_lista_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id, 'revision', v_lista.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_lista_id, 'revision', v_lista.revisao,
    'state', v_lista.estado, 'requestId', p_request_id);
  insert into pcm.sso_portal_materiais_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
