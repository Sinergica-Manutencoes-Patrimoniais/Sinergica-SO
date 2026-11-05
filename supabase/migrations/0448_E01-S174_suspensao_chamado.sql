-- ADR-0222: agregado aditivo, sem alteração de status legado.
create table pcm.sso_suspensao_chamado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_suspensao_chamado_gate(id,habilitado) values(true,false);
create table pcm.sso_suspensoes_chamado(chamado_id uuid primary key references pcm.chamados(id),cliente_id uuid not null references pcm.clientes(id),estado text not null check(estado in ('suspenso','retomado')),revisao integer not null check(revisao>0),atualizado_em timestamptz not null default now());
create table pcm.sso_suspensoes_chamado_eventos(chamado_id uuid not null references pcm.chamados(id),revisao integer not null,estado text not null check(estado in ('suspenso','retomado')),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,chamado_revision bigint not null,criado_em timestamptz not null default now(),primary key(chamado_id,revisao));
alter table pcm.sso_suspensao_chamado_gate enable row level security;
alter table pcm.sso_suspensao_chamado_gate force row level security;
alter table pcm.sso_suspensoes_chamado enable row level security;
alter table pcm.sso_suspensoes_chamado force row level security;
alter table pcm.sso_suspensoes_chamado_eventos enable row level security;
alter table pcm.sso_suspensoes_chamado_eventos force row level security;
revoke all on pcm.sso_suspensao_chamado_gate,pcm.sso_suspensoes_chamado,pcm.sso_suspensoes_chamado_eventos from public,anon,authenticated,service_role;
create function pcm.sso_suspensao_chamado_eventos_imutaveis() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514';end; $$;
revoke all on function pcm.sso_suspensao_chamado_eventos_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_suspensao_chamado_eventos_imutaveis before update or delete on pcm.sso_suspensoes_chamado_eventos for each row execute function pcm.sso_suspensao_chamado_eventos_imutaveis();
create function pcm.sso_alterar_suspensao_chamado(p_request_id uuid,p_chamado_id uuid,p_chamado_revision bigint,p_expected_revision integer,p_estado text,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_c pcm.chamados%rowtype;v_s pcm.sso_suspensoes_chamado%rowtype;v_e pcm.sso_suspensoes_chamado_eventos%rowtype;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_suspensao_chamado_gate where id),false) then raise exception 'suspensao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_chamado_id is null or p_chamado_revision is null or p_chamado_revision<1 or p_expected_revision is null or p_expected_revision<0 or p_estado is null or p_estado not in ('suspenso','retomado') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('suspensao-chamado:'||p_request_id::text,0));
  select * into v_c from pcm.chamados where id=p_chamado_id for update;
  if not found or v_c.deleted_at is not null or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_e from pcm.sso_suspensoes_chamado_eventos where request_id=p_request_id;
  if found then
    if v_e.ator_id is distinct from v_ator or v_e.chamado_id is distinct from p_chamado_id or v_e.revisao<>p_expected_revision+1 or v_e.chamado_revision<>p_chamado_revision or v_e.estado is distinct from p_estado or v_e.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('chamadoId',p_chamado_id,'revision',v_e.revisao,'estado',v_e.estado,'requestId',p_request_id);
  end if;
  if v_c.sso_revisao<>p_chamado_revision then raise exception 'revisao_chamado_obsoleta' using errcode='40001'; end if;
  if v_c.status not in ('aberto','convertido_os') then raise exception 'chamado_indisponivel' using errcode='23514'; end if;
  select * into v_s from pcm.sso_suspensoes_chamado where chamado_id=p_chamado_id for update;
  if coalesce(v_s.revisao,0)<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if (v_s.chamado_id is null and p_estado<>'suspenso') or (v_s.chamado_id is not null and (v_s.estado=p_estado or v_s.cliente_id is distinct from v_c.cliente_id)) then raise exception 'transicao_invalida' using errcode='23514'; end if;
  insert into pcm.sso_suspensoes_chamado(chamado_id,cliente_id,estado,revisao) values(p_chamado_id,v_c.cliente_id,p_estado,p_expected_revision+1)
    on conflict(chamado_id) do update set estado=excluded.estado,revisao=excluded.revisao,atualizado_em=now();
  insert into pcm.sso_suspensoes_chamado_eventos(chamado_id,revisao,estado,motivo,ator_id,request_id,chamado_revision) values(p_chamado_id,p_expected_revision+1,p_estado,btrim(p_motivo),v_ator,p_request_id,p_chamado_revision);
  v_resultado:=jsonb_build_object('chamadoId',p_chamado_id,'revision',p_expected_revision+1,'estado',p_estado,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.suspensao_alterada','chamados',p_chamado_id,v_resultado||jsonb_build_object('clienteId',v_c.cliente_id,'motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_alterar_suspensao_chamado(uuid,uuid,bigint,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_consultar_suspensao_chamado(p_chamado_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_c pcm.chamados%rowtype;v_s pcm.sso_suspensoes_chamado%rowtype;
begin
  select * into v_c from pcm.chamados where id=p_chamado_id and deleted_at is null;
  if not found or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_s from pcm.sso_suspensoes_chamado where chamado_id=p_chamado_id and cliente_id=v_c.cliente_id;
  return jsonb_build_object('chamadoId',p_chamado_id,'chamadoRevision',v_c.sso_revisao,'revision',coalesce(v_s.revisao,0),'estado',v_s.estado);
end;
$$;
revoke all on function pcm.sso_consultar_suspensao_chamado(uuid) from public,anon,authenticated,service_role;
