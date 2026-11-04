-- ADR-0224: declaração administrativa, sem interferir em execução.
create table pcm.sso_interrupcao_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_interrupcao_parcela_gate(id,habilitado) values(true,false);
create table pcm.sso_interrupcoes_parcela(parcela_id uuid not null references pcm.chamado_escopo_parcelas(id),os_id uuid not null references pcm.ordens_servico(id),chamado_id uuid not null references pcm.chamados(id),cliente_id uuid not null references pcm.clientes(id),estado text not null check(estado in ('declarada','revogada')),revisao integer not null check(revisao>0),atualizado_em timestamptz not null default now(),primary key(parcela_id,os_id));
create table pcm.sso_interrupcoes_parcela_eventos(parcela_id uuid not null,os_id uuid not null,revisao integer not null,estado text not null check(estado in ('declarada','revogada')),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,payload jsonb not null,criado_em timestamptz not null default now(),primary key(parcela_id,os_id,revisao),foreign key(parcela_id,os_id) references pcm.sso_interrupcoes_parcela(parcela_id,os_id));
alter table pcm.sso_interrupcao_parcela_gate enable row level security;alter table pcm.sso_interrupcao_parcela_gate force row level security;
alter table pcm.sso_interrupcoes_parcela enable row level security;alter table pcm.sso_interrupcoes_parcela force row level security;
alter table pcm.sso_interrupcoes_parcela_eventos enable row level security;alter table pcm.sso_interrupcoes_parcela_eventos force row level security;
revoke all on pcm.sso_interrupcao_parcela_gate,pcm.sso_interrupcoes_parcela,pcm.sso_interrupcoes_parcela_eventos from public,anon,authenticated,service_role;
create function pcm.sso_interrupcoes_eventos_imutaveis() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514';end; $$;
revoke all on function pcm.sso_interrupcoes_eventos_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_interrupcoes_eventos_imutaveis before update or delete on pcm.sso_interrupcoes_parcela_eventos for each row execute function pcm.sso_interrupcoes_eventos_imutaveis();
create function pcm.sso_declarar_interrupcao_parcela(p_request_id uuid,p_parcela_id uuid,p_os_id uuid,p_escopo_revision bigint,p_suspensao_revision integer,p_expected_revision integer,p_estado text,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_p pcm.chamado_escopo_parcelas%rowtype;v_c pcm.chamados%rowtype;v_e pcm.chamado_escopo_composicoes%rowtype;v_s pcm.sso_suspensoes_chamado%rowtype;v_i pcm.sso_interrupcoes_parcela%rowtype;v_a pcm.sso_interrupcoes_parcela_eventos%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_interrupcao_parcela_gate where id),false) then raise exception 'declaracao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_parcela_id is null or p_os_id is null or p_escopo_revision is null or p_escopo_revision<1 or p_suspensao_revision is null or p_suspensao_revision<1 or p_expected_revision is null or p_expected_revision<0 or p_estado is null or p_estado not in ('declarada','revogada') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'escopoRevision',p_escopo_revision,'suspensaoRevision',p_suspensao_revision,'expectedRevision',p_expected_revision,'estado',p_estado,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('interrupcao-parcela:'||p_request_id::text,0));
  select * into v_a from pcm.sso_interrupcoes_parcela_eventos where request_id=p_request_id;
  if found then
    select * into v_i from pcm.sso_interrupcoes_parcela where parcela_id=v_a.parcela_id and os_id=v_a.os_id;
    if v_a.ator_id is distinct from v_ator or config.sso_autorizar_acao('chamado.escopo.gerir',v_i.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_a.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('parcelaId',v_a.parcela_id,'osId',v_a.os_id,'revision',v_a.revisao,'estado',v_a.estado,'requestId',p_request_id);
  end if;
  select * into v_p from pcm.chamado_escopo_parcelas where id=p_parcela_id;
  if not found then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
  select * into v_c from pcm.chamados where id=v_p.chamado_id for update;
  if not found or v_c.deleted_at is not null or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_e from pcm.chamado_escopo_composicoes where chamado_id=v_c.id for update;
  select * into v_s from pcm.sso_suspensoes_chamado where chamado_id=v_c.id and cliente_id=v_c.cliente_id for update;
  if v_e.chamado_id is null or v_e.revisao<>p_escopo_revision or v_s.chamado_id is null or v_s.estado<>'suspenso' or v_s.revisao<>p_suspensao_revision then raise exception 'revisao_ou_suspensao_invalida' using errcode='40001'; end if;
  select * into v_p from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_c.id for update;
  if not found or v_p.situacao<>'pendente' or not exists(select 1 from pcm.sso_backlog_parcelas b where b.parcela_id=p_parcela_id and b.chamado_id=v_c.id and b.cliente_id=v_c.cliente_id) then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
  perform 1 from pcm.ordens_servico o where o.id=p_os_id and o.chamado_id=v_c.id and o.client_id=v_c.cliente_id and o.deleted_at is null for share;
  if not found then raise exception 'os_incompativel' using errcode='23514'; end if;
  select * into v_i from pcm.sso_interrupcoes_parcela where parcela_id=p_parcela_id and os_id=p_os_id for update;
  if coalesce(v_i.revisao,0)<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if (v_i.parcela_id is null and p_estado<>'declarada') or (v_i.parcela_id is not null and v_i.estado=p_estado) then raise exception 'transicao_invalida' using errcode='23514'; end if;
  insert into pcm.sso_interrupcoes_parcela(parcela_id,os_id,chamado_id,cliente_id,estado,revisao) values(p_parcela_id,p_os_id,v_c.id,v_c.cliente_id,p_estado,p_expected_revision+1)
    on conflict(parcela_id,os_id) do update set estado=excluded.estado,revisao=excluded.revisao,atualizado_em=now();
  insert into pcm.sso_interrupcoes_parcela_eventos(parcela_id,os_id,revisao,estado,motivo,ator_id,request_id,payload) values(p_parcela_id,p_os_id,p_expected_revision+1,p_estado,btrim(p_motivo),v_ator,p_request_id,v_payload);
  v_resultado:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'revision',p_expected_revision+1,'estado',p_estado,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.interrupcao_declarada','chamados',v_c.id,v_resultado||jsonb_build_object('clienteId',v_c.cliente_id,'motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_declarar_interrupcao_parcela(uuid,uuid,uuid,bigint,integer,integer,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_listar_interrupcoes_parcela(p_parcela_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,estado text,revisao integer,atualizado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
  if p_parcela_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select c.cliente_id into v_cliente from pcm.chamado_escopo_parcelas p join pcm.chamados c on c.id=p.chamado_id and c.deleted_at is null where p.id=p_parcela_id;
  if not found or config.sso_autorizar_acao('chamado.escopo.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select i.os_id,i.estado,i.revisao,i.atualizado_em from pcm.sso_interrupcoes_parcela i where i.parcela_id=p_parcela_id and i.cliente_id=v_cliente and (p_apos is null or i.os_id>p_apos) order by i.os_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_interrupcoes_parcela(uuid,uuid,integer) from public,anon,authenticated,service_role;
