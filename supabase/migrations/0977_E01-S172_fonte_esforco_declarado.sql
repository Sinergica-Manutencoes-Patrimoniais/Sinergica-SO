-- ADR-0773: preparação interna; não expõe RPC nem abre gate.
create table pcm.capacidade_esforco_declarado_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
alter table pcm.capacidade_esforco_declarado_gate enable row level security;
alter table pcm.capacidade_esforco_declarado_gate force row level security;
revoke all on pcm.capacidade_esforco_declarado_gate from public, anon, authenticated, service_role;
insert into pcm.capacidade_esforco_declarado_gate(id,habilitado) values (true,false);

create table pcm.capacidade_esforco_declaracoes (
  request_id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  os_id uuid references pcm.ordens_servico(id),
  ocorrencia_id uuid references pcm.ocorrencias_rotina_preparadas(id),
  revisao integer not null check (revisao > 0),
  internos_minutos integer check (internos_minutos >= 0),
  terceiros_minutos integer check (terceiros_minutos >= 0),
  acompanhamento_minutos integer check (acompanhamento_minutos >= 0),
  justificativa text not null check (length(btrim(justificativa)) between 1 and 2000),
  payload jsonb not null,
  ator_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  check ((os_id is not null) <> (ocorrencia_id is not null))
);
create unique index capacidade_esforco_os_revisao_idx on pcm.capacidade_esforco_declaracoes(cliente_id,os_id,revisao) where os_id is not null;
create unique index capacidade_esforco_ocorrencia_revisao_idx on pcm.capacidade_esforco_declaracoes(cliente_id,ocorrencia_id,revisao) where ocorrencia_id is not null;
alter table pcm.capacidade_esforco_declaracoes enable row level security;
alter table pcm.capacidade_esforco_declaracoes force row level security;
revoke all on pcm.capacidade_esforco_declaracoes from public, anon, authenticated, service_role;
create trigger capacidade_esforco_imutavel before update or delete on pcm.capacidade_esforco_declaracoes
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_declarar_esforco_capacidade(
  p_request_id uuid, p_cliente_id uuid, p_origem_tipo text, p_origem_id uuid, p_expected_revision integer,
  p_internos_minutos integer, p_terceiros_minutos integer, p_acompanhamento_minutos integer, p_justificativa text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid(); v_revisao integer; v_anterior pcm.capacidade_esforco_declaracoes%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  perform 1 from pcm.capacidade_esforco_declarado_gate where id for share;
  if not coalesce((select habilitado from pcm.capacidade_esforco_declarado_gate where id),false) then
    raise exception 'esforco_capacidade_bloqueado' using errcode='55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_autorizacao_incompativel' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_origem_id is null
     or p_origem_tipo is null or p_origem_tipo not in ('os','ocorrencia')
     or p_expected_revision is null or p_expected_revision < 0
     or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000
     or p_internos_minutos < 0 or p_terceiros_minutos < 0 or p_acompanhamento_minutos < 0 then
    raise exception 'declaracao_invalida' using errcode='22023';
  end if;
  if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  if p_origem_tipo='os' then
    perform 1 from pcm.ordens_servico o where o.id=p_origem_id and o.client_id=p_cliente_id and o.deleted_at is null for share;
  else
    perform 1 from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id
      where o.id=p_origem_id and p.cliente_id=p_cliente_id for share of o,p;
  end if;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'origemTipo',p_origem_tipo,'origemId',p_origem_id,
    'expectedRevision',p_expected_revision,'internosMinutos',p_internos_minutos,'terceirosMinutos',p_terceiros_minutos,
    'acompanhamentoMinutos',p_acompanhamento_minutos,'justificativa',btrim(p_justificativa));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_anterior from pcm.capacidade_esforco_declaracoes where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode='23505';
    end if;
    return jsonb_build_object('requestId',p_request_id,'revision',v_anterior.revisao);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capacidade-esforco:'||p_origem_tipo||':'||p_origem_id::text,0));
  select coalesce(max(revisao),0) into v_revisao from pcm.capacidade_esforco_declaracoes
    where cliente_id=p_cliente_id and ((p_origem_tipo='os' and os_id=p_origem_id) or (p_origem_tipo='ocorrencia' and ocorrencia_id=p_origem_id));
  if v_revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.capacidade_esforco_declaracoes(request_id,cliente_id,os_id,ocorrencia_id,revisao,internos_minutos,terceiros_minutos,acompanhamento_minutos,justificativa,payload,ator_id)
    values(p_request_id,p_cliente_id,case when p_origem_tipo='os' then p_origem_id end,
      case when p_origem_tipo='ocorrencia' then p_origem_id end,v_revisao+1,p_internos_minutos,p_terceiros_minutos,p_acompanhamento_minutos,btrim(p_justificativa),v_payload,v_ator);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'revision',v_revisao+1);
  insert into audit.events(actor_id,action,entity,entity_id,payload)
    values(v_ator,'capacidade.esforco_declarado','capacidade_esforco_declaracoes',p_request_id,v_payload);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_esforco_capacidade(uuid,uuid,text,uuid,integer,integer,integer,integer,text)
  from public, anon, authenticated, service_role;
