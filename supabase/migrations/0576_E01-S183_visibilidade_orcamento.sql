-- ADR-0350: trilha aditiva para snapshot público existente.
create table comercial.sso_visibilidade_orcamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_visibilidade_orcamento_gate(id,habilitado) values(true,false);
alter table comercial.sso_visibilidade_orcamento_gate enable row level security;
alter table comercial.sso_visibilidade_orcamento_gate force row level security;
revoke all on comercial.sso_visibilidade_orcamento_gate from public,anon,authenticated,service_role;
create table comercial.sso_visibilidade_orcamento_eventos(
  proposta_id uuid not null,versao integer not null,sequencia integer not null check(sequencia>0),acao text not null check(acao in ('retirar','republicar')),
  motivo text not null check(length(btrim(motivo)) between 1 and 1000),request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  primary key(proposta_id,versao,sequencia),foreign key(proposta_id,versao) references comercial.sso_orcamento_publicacoes(proposta_id,versao)
);
alter table comercial.sso_visibilidade_orcamento_eventos enable row level security;
alter table comercial.sso_visibilidade_orcamento_eventos force row level security;
revoke all on comercial.sso_visibilidade_orcamento_eventos from public,anon,authenticated,service_role;
create function comercial.sso_orcamento_publico_visivel(p_proposta_id uuid,p_versao integer)
returns boolean language sql stable security definer set search_path='' as $$
  select not coalesce((select habilitado from comercial.sso_visibilidade_orcamento_gate where id),false)
    or coalesce((select e.acao from comercial.sso_visibilidade_orcamento_eventos e where e.proposta_id=p_proposta_id and e.versao=p_versao order by e.sequencia desc limit 1),'publicar')<>'retirar';
$$;
revoke all on function comercial.sso_orcamento_publico_visivel(uuid,integer) from public,anon,authenticated,service_role;
create function comercial.sso_visibilidade_orcamento(p_request_id uuid,p_proposta_id uuid,p_versao integer,p_acao text,p_motivo text)
returns integer language plpgsql security definer set search_path='' as $$
declare p comercial.propostas%rowtype; anterior comercial.sso_visibilidade_orcamento_eventos%rowtype; v_ultima text; v_seq integer;
begin
  if auth.uid() is null or p_request_id is null or p_proposta_id is null or p_versao is null or p_versao<1
    or p_acao is null or p_acao not in ('retirar','republicar') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  if not coalesce((select habilitado from comercial.sso_visibilidade_orcamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visibilidade-orcamento:'||p_request_id::text,0));
  select * into p from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
  if not found or comercial.sso_orcamento_operacional_autorizado(p_proposta_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from comercial.sso_visibilidade_orcamento_eventos where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.proposta_id<>p_proposta_id or anterior.versao<>p_versao or anterior.acao<>p_acao or anterior.motivo<>btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.sequencia;
  end if;
  if p.status<>'enviada' or p.versao_atual<>p_versao or not exists(select 1 from comercial.sso_orcamento_publicacoes pub where pub.proposta_id=p.id and pub.versao=p_versao)
    then raise exception 'versao_ou_estado_invalido' using errcode='40001'; end if;
  select e.acao,e.sequencia into v_ultima,v_seq from comercial.sso_visibilidade_orcamento_eventos e where e.proposta_id=p.id and e.versao=p_versao order by e.sequencia desc limit 1;
  if (p_acao='retirar' and v_ultima='retirar') or (p_acao='republicar' and coalesce(v_ultima,'publicar')<>'retirar') then raise exception 'visibilidade_invalida' using errcode='23514'; end if;
  v_seq:=coalesce(v_seq,0)+1;
  insert into comercial.sso_visibilidade_orcamento_eventos(proposta_id,versao,sequencia,acao,motivo,request_id,ator_id) values(p.id,p_versao,v_seq,p_acao,btrim(p_motivo),p_request_id,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.portal_'||p_acao,'propostas',p.id,jsonb_build_object('requestId',p_request_id,'versao',p_versao,'sequencia',v_seq));
  return v_seq;
end $$;
revoke all on function comercial.sso_visibilidade_orcamento(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function comercial.sso_consultar_visibilidade_orcamento(p_proposta_id uuid,p_versao integer)
returns table(situacao text,sequencia integer,acao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or comercial.sso_orcamento_operacional_autorizado(p_proposta_id) is not true or not coalesce((select habilitado from comercial.sso_visibilidade_orcamento_gate where id),false)
    or not exists(select 1 from comercial.sso_orcamento_publicacoes p where p.proposta_id=p_proposta_id and p.versao=p_versao) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select coalesce((select e.acao from comercial.sso_visibilidade_orcamento_eventos e where e.proposta_id=p_proposta_id and e.versao=p_versao order by e.sequencia desc limit 1),'publicar'),
    e.sequencia,e.acao,e.motivo,e.ator_id,e.criado_em from (select 1) s left join lateral(select x.* from comercial.sso_visibilidade_orcamento_eventos x where x.proposta_id=p_proposta_id and x.versao=p_versao order by x.sequencia desc limit 20) e on true;
end $$;
revoke all on function comercial.sso_consultar_visibilidade_orcamento(uuid,integer) from public,anon,authenticated,service_role;


-- Atualizações somente após a criação do helper; assinaturas e concessões existentes permanecem.
create or replace function comercial.sso_portal_detalhe_operacional(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_publico jsonb;
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or p_proposta_id is null or p_versao is null or p_versao < 1
    or not exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
      where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico') then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from comercial.sso_exportacao_operacional_gate g where g.id), false) then
    raise exception 'exportacao_indisponivel' using errcode = '55000'; end if;
  select comercial.projecao_proposta_publica(pub.payload_publico) into v_publico
    from comercial.propostas p join comercial.proposta_origens_operacionais origem on origem.proposta_id = p.id
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id and l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.client_id = p_cliente_id and os.deleted_at is null
    join comercial.sso_orcamento_publicacoes pub on pub.proposta_id = p.id and pub.versao = p.versao_atual
    left join comercial.oportunidades op on op.id = p.oportunidade_id and op.cliente_id = p_cliente_id and op.deleted_at is null
    where p.id = p_proposta_id and p.deleted_at is null and p.versao_atual = p_versao
      and p.status in ('enviada', 'aceita', 'recusada') and comercial.sso_orcamento_publico_visivel(p.id,p_versao)
      and ((p.oportunidade_id is not null and op.id is not null) or
        (p.oportunidade_id is null and coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false)));
  if v_publico is null then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return jsonb_build_object('propostaId', p_proposta_id, 'versao', p_versao, 'ordemServicoId', p_os_id, 'payload', v_publico);
end;
$$;

create or replace function comercial.sso_portal_propostas_os(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(id uuid, ordem_servico_id uuid, status text, versao integer, valido_ate date, payload jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico'
  ) or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select g.habilitado from comercial.sso_exportacao_operacional_gate g where g.id), false) then
    raise exception 'exportacao_indisponivel' using errcode = '55000'; end if;
  return query select p.id, origem.ordem_servico_id, p.status, p.versao_atual, p.valido_ate,
    comercial.projecao_proposta_publica(pub.payload_publico)
    from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id = origem.proposta_id and p.deleted_at is null
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id and l.cliente_id = p_cliente_id and l.ordem_servico_id = p_os_id
    left join comercial.oportunidades o on o.id = p.oportunidade_id and o.cliente_id = p_cliente_id and o.deleted_at is null
    join comercial.proposta_versoes v on v.proposta_id = p.id and v.versao = p.versao_atual
    join comercial.sso_orcamento_publicacoes pub on pub.proposta_id = p.id and pub.versao = p.versao_atual
    where origem.ordem_servico_id = p_os_id
      and ((p.oportunidade_id is not null and o.id is not null) or
        (p.oportunidade_id is null and pub.proposta_id is not null and coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false)))
      and p.status in ('enviada', 'aceita', 'recusada') and comercial.sso_orcamento_publico_visivel(p.id,p.versao_atual)
      and (p_apos is null or p.id > p_apos) order by p.id limit 20;
end;
$$;

create or replace function comercial.sso_portal_historico_operacional(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_apos integer default 0)
returns table(versao integer, publicado_em timestamptz) language plpgsql stable security definer set search_path = '' as $$
begin
  if p_apos is null or p_apos < 0 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if comercial.sso_portal_origem_operacional_autorizada(p_cliente_id, p_os_id, p_proposta_id) is not true then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select pub.versao, pub.publicado_em from comercial.sso_orcamento_publicacoes pub
    where pub.proposta_id = p_proposta_id and pub.versao > p_apos and comercial.sso_orcamento_publico_visivel(pub.proposta_id,pub.versao) order by pub.versao limit 20;
end;
$$;

create or replace function comercial.sso_portal_versao_operacional(p_cliente_id uuid, p_os_id uuid, p_proposta_id uuid, p_versao integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  if p_versao is null or p_versao < 1 or comercial.sso_portal_origem_operacional_autorizada(p_cliente_id, p_os_id, p_proposta_id) is not true then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select comercial.projecao_proposta_publica(pub.payload_publico) into v_payload
    from comercial.sso_orcamento_publicacoes pub where pub.proposta_id = p_proposta_id and pub.versao = p_versao and comercial.sso_orcamento_publico_visivel(pub.proposta_id,pub.versao);
  if v_payload is null then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return jsonb_build_object('propostaId', p_proposta_id, 'versao', p_versao, 'ordemServicoId', p_os_id, 'payload', v_payload);
end;
$$;

create or replace function comercial.sso_portal_itens_publicos(p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_itens jsonb;
begin
  if auth.uid() is null or not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false)
    or not exists(select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id=uc.user_id
      where uc.user_id=auth.uid() and uc.cliente_id=p_cliente_id and u.ativo and u.papel='cliente-sindico') then raise exception 'sem_acesso' using errcode='42501'; end if;
  select s.itens into v_itens from comercial.sso_itens_publicos_proposta s join comercial.propostas p on p.id=s.proposta_id and p.versao_atual=s.versao and p.deleted_at is null and p.status in ('enviada','aceita','recusada')
    join comercial.proposta_origens_operacionais origem on origem.proposta_id=p.id
    join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id
    join pcm.ordens_servico o on o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null
    where s.proposta_id=p_proposta_id and s.versao=p_versao and comercial.sso_orcamento_publico_visivel(s.proposta_id,s.versao);
  if v_itens is null then raise exception 'itens_indisponiveis' using errcode='42501'; end if;
  return v_itens;
end $$;

create or replace function comercial.sso_guardar_aceite_itens_publicos() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('aceita','recusada') and old.status is distinct from new.status
    and exists(select 1 from comercial.proposta_origens_operacionais origem where origem.proposta_id=new.id)
    and not comercial.sso_orcamento_publico_visivel(new.id,new.versao_atual)
    then raise exception 'orcamento_retirado' using errcode='23514'; end if;
  if new.status in ('aceita','recusada') and old.status is distinct from new.status
    and coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false)
    and exists(select 1 from comercial.proposta_origens_operacionais origem where origem.proposta_id=new.id)
    and not exists(select 1 from comercial.sso_itens_publicos_proposta s where s.proposta_id=new.id and s.versao=new.versao_atual)
    then raise exception 'snapshot_itens_publicos_ausente' using errcode='23514'; end if;
  return new;
end $$;

create or replace function comercial.sso_portal_itens_publicos_historico(p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_itens jsonb;
begin
  if p_versao is null or p_versao<1 or comercial.sso_portal_origem_operacional_autorizada(p_cliente_id,p_os_id,p_proposta_id) is not true
    then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if not exists(select 1 from comercial.sso_orcamento_publicacoes p where p.proposta_id=p_proposta_id and p.versao=p_versao and comercial.sso_orcamento_publico_visivel(p.proposta_id,p.versao))
    then raise exception 'versao_indisponivel' using errcode='42501'; end if;
  select s.itens into v_itens from comercial.sso_itens_publicos_proposta s where s.proposta_id=p_proposta_id and s.versao=p_versao;
  return jsonb_build_object('estruturado',v_itens is not null,'itens',coalesce(v_itens,'[]'::jsonb));
end $$;

