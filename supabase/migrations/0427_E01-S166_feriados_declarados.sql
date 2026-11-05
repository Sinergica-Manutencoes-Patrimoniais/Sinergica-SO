-- ADR-0201: declaração revisada e auditada, sem consulta externa nem geração automática.
create table pcm.feriado_declarado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.feriado_declarado_gate enable row level security;
alter table pcm.feriado_declarado_gate force row level security;
revoke all on pcm.feriado_declarado_gate from public,anon,authenticated,service_role;
insert into pcm.feriado_declarado_gate(id,habilitado) values(true,false);
create table pcm.feriados_declarados (
  id uuid primary key,cliente_id uuid not null references pcm.clientes(id),contrato_id uuid,
  data date not null check(isfinite(data)),fonte text not null check(length(btrim(fonte)) between 1 and 500),
  motivo text not null check(length(btrim(motivo)) between 1 and 2000),ativo boolean not null default true,
  revisao integer not null default 1 check(revisao>0),criado_por uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  foreign key(contrato_id,cliente_id) references comercial.contratos(id,cliente_id),
  unique nulls not distinct(cliente_id,contrato_id,data)
);
create table pcm.feriado_declarado_eventos (
  id uuid primary key default gen_random_uuid(),feriado_id uuid not null references pcm.feriados_declarados(id),
  revisao integer not null,acao text not null check(acao in ('declarar','retirar')),
  motivo text not null,ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now(),
  unique(feriado_id,revisao)
);
create table pcm.feriado_declarado_comandos (
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),payload jsonb not null,resultado jsonb not null
);
alter table pcm.feriados_declarados enable row level security;
alter table pcm.feriados_declarados force row level security;
alter table pcm.feriado_declarado_eventos enable row level security;
alter table pcm.feriado_declarado_eventos force row level security;
alter table pcm.feriado_declarado_comandos enable row level security;
alter table pcm.feriado_declarado_comandos force row level security;
revoke all on pcm.feriados_declarados,pcm.feriado_declarado_eventos,pcm.feriado_declarado_comandos from public,anon,authenticated,service_role;
create function pcm.sso_proteger_evento_feriado() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'evento_feriado_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_evento_feriado() from public,anon,authenticated,service_role;
create trigger feriado_evento_imutavel before update or delete on pcm.feriado_declarado_eventos for each row execute function pcm.sso_proteger_evento_feriado();

create function pcm.sso_decidir_feriado_declarado(p_request_id uuid,p_cliente_id uuid,p_feriado_id uuid,p_expected_revision integer,
  p_acao text,p_contrato_id uuid,p_data date,p_fonte text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_comando pcm.feriado_declarado_comandos%rowtype;v_feriado pcm.feriados_declarados%rowtype;
  v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.feriado_declarado_gate where id),false) then raise exception 'feriados_bloqueados' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_cliente_id is null or p_feriado_id is null or p_expected_revision is null or p_expected_revision<0
    or p_acao is null or p_acao not in ('declarar','retirar') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or (p_acao='declarar' and (p_expected_revision<>0 or p_data is null or not isfinite(p_data) or p_fonte is null or length(btrim(p_fonte)) not between 1 and 500))
    or (p_acao='retirar' and (p_expected_revision<1 or p_data is not null or p_contrato_id is not null or p_fonte is not null)) then
    raise exception 'declaracao_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'feriadoId',p_feriado_id,'expectedRevision',p_expected_revision,
    'acao',p_acao,'contratoId',p_contrato_id,'data',p_data,'fonte',p_fonte,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('feriado-request:'||p_request_id::text,0));
  select * into v_comando from pcm.feriado_declarado_comandos where request_id=p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_actor or v_comando.cliente_id is distinct from p_cliente_id or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  if p_acao='declarar' then
    if p_contrato_id is not null and not exists(select 1 from comercial.contratos where id=p_contrato_id and cliente_id=p_cliente_id) then
      raise exception 'contrato_invalido' using errcode='23514'; end if;
    insert into pcm.feriados_declarados(id,cliente_id,contrato_id,data,fonte,motivo,criado_por)
      values(p_feriado_id,p_cliente_id,p_contrato_id,p_data,btrim(p_fonte),btrim(p_motivo),v_actor) returning * into v_feriado;
  else
    select * into v_feriado from pcm.feriados_declarados where id=p_feriado_id and cliente_id=p_cliente_id for update;
    if not found then raise exception 'feriado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
    if v_feriado.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
    if not v_feriado.ativo then raise exception 'feriado_ja_retirado' using errcode='23514'; end if;
    update pcm.feriados_declarados set ativo=false,revisao=revisao+1 where id=p_feriado_id returning * into v_feriado;
  end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  insert into pcm.feriado_declarado_eventos(feriado_id,revisao,acao,motivo,ator_id,request_id)
    values(p_feriado_id,v_feriado.revisao,p_acao,btrim(p_motivo),v_actor,p_request_id);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'feriadoId',p_feriado_id,'revision',v_feriado.revisao,'ativo',v_feriado.ativo);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.feriado_'||p_acao,'feriados_declarados',p_feriado_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revision',v_feriado.revisao));
  insert into pcm.feriado_declarado_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_decidir_feriado_declarado(uuid,uuid,uuid,integer,text,uuid,date,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_feriados_declarados(p_cliente_id uuid,p_contrato_id uuid,p_inicio date,p_fim date,p_apos uuid,p_limite integer)
returns table(id uuid,contrato_id uuid,data date,fonte text,motivo text,ativo boolean,revisao integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.feriado_declarado_gate where id),false) then raise exception 'feriados_bloqueados' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>366
    or p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
  if p_contrato_id is not null and not exists(select 1 from comercial.contratos c where c.id=p_contrato_id and c.cliente_id=p_cliente_id) then raise exception 'contrato_invalido' using errcode='23514'; end if;
  return query select f.id,f.contrato_id,f.data,f.fonte,f.motivo,f.ativo,f.revisao from pcm.feriados_declarados f
    where f.cliente_id=p_cliente_id and f.data between p_inicio and p_fim
      and (f.contrato_id is null or f.contrato_id=p_contrato_id) and (p_apos is null or f.id>p_apos) order by f.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_feriados_declarados(uuid,uuid,date,date,uuid,integer) from public,anon,authenticated,service_role;
