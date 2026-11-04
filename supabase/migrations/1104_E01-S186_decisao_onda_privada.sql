-- ADR-0950: aceite declarado e privado; não libera operação ou produção.
create table pcm.sso_decisao_onda_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_decisao_onda_gate(id,habilitado) values(true,false);
create table pcm.sso_decisoes_onda (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
  cliente_id uuid not null, onda smallint not null, revisao_evidencias integer not null,
  versao text not null, ambiente text not null, ator_id uuid not null references auth.users(id),
  ressalva text not null, referencias jsonb not null, evidencias jsonb not null,
  payload jsonb not null, criado_em timestamptz not null default now(),
  foreign key(cliente_id,onda) references pcm.sso_ondas_homologacao(cliente_id,onda),
  check (onda between 1 and 6), check (revisao_evidencias >= 0)
);
alter table pcm.sso_decisao_onda_gate enable row level security;
alter table pcm.sso_decisao_onda_gate force row level security;
alter table pcm.sso_decisoes_onda enable row level security;
alter table pcm.sso_decisoes_onda force row level security;
revoke all on pcm.sso_decisao_onda_gate,pcm.sso_decisoes_onda from public,anon,authenticated,service_role;
create function pcm.sso_decisao_onda_imutavel() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'decisao_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_decisao_onda_imutavel() from public,anon,authenticated,service_role;
create trigger sso_decisao_onda_imutavel before update or delete on pcm.sso_decisoes_onda
  for each row execute function pcm.sso_decisao_onda_imutavel();

create function pcm.sso_registrar_decisao_onda(
  p_request_id uuid,p_cliente_id uuid,p_onda smallint,p_revision integer,p_versao text,p_ambiente text,
  p_referencias jsonb,p_ressalva text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_ator uuid:=auth.uid();v_payload jsonb;v_anterior pcm.sso_decisoes_onda%rowtype;
  v_cts text[];v_verificacoes text[];v_revisao integer;v_cenario text;v_e pcm.sso_evidencias_ondas%rowtype;
  v_evidencias jsonb:='[]'::jsonb;v_id uuid;v_chave text;
begin
  perform 1 from pcm.sso_decisao_onda_gate where id and habilitado for share;
  if not found then raise exception 'decisao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_evidencias_ondas_gate where id and habilitado for share;
  if not found then raise exception 'evidencias_desabilitadas' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_onda is null or p_onda not between 1 and 6
    or p_revision is null or p_revision<0 or p_versao is null or length(btrim(p_versao)) not between 1 and 120
    or p_ambiente is null or length(btrim(p_ambiente)) not between 1 and 120 or p_ressalva is null or length(p_ressalva)>2000
    or jsonb_typeof(p_referencias) is distinct from 'object' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_cts:=case p_onda
    when 1 then array['CT-012','CT-013','CT-014','CT-015']
    when 2 then array['CT-001','CT-002','CT-003','CT-004','CT-005','CT-006','CT-007','CT-008','CT-009','CT-010','CT-011']
    when 3 then array[]::text[] when 4 then array['CT-016','CT-017','CT-018','CT-019','CT-020','CT-021']
    when 5 then array['CT-022','CT-023','CT-025'] else array['CT-024','CT-026','CT-027','CT-028','CT-029'] end;
  v_verificacoes:=case p_onda
    when 1 then array['arvore_busca','validacao_cadastral'] when 2 then array['envio_t24']
    when 3 then array['plano_versoes','calendario_feriados','tempos_pendentes','questionarios']
    when 4 then array['rastreabilidade_duplicidade'] when 5 then array['cliente_autorizado','aquisicao_orcamento']
    else array['cliente_autorizado','seguranca_cobranca'] end;
  if (select count(*) from jsonb_object_keys(p_referencias))<>cardinality(v_verificacoes) then raise exception 'verificacoes_incompletas' using errcode='22023'; end if;
  foreach v_chave in array v_verificacoes loop
    if jsonb_typeof(p_referencias->v_chave) is distinct from 'string'
      or length(p_referencias->>v_chave) not between 1 and 200 or (p_referencias->>v_chave) !~ '^[A-Za-z0-9_.:-]+$' then
      raise exception 'verificacoes_incompletas' using errcode='22023'; end if;
  end loop;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'onda',p_onda,'revision',p_revision,'versao',btrim(p_versao),
    'ambiente',btrim(p_ambiente),'referencias',p_referencias,'ressalva',p_ressalva);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-onda:'||p_request_id::text,0));
  select * into v_anterior from pcm.sso_decisoes_onda where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.cliente_id is distinct from p_cliente_id then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('id',v_anterior.id,'requestId',p_request_id,'clienteId',p_cliente_id,'onda',p_onda,'revision',v_anterior.revisao_evidencias);
  end if;
  -- Travar a onda anterior primeiro impede mudança da fotografia durante a decisão da onda 2.
  if p_onda=2 then
    perform 1 from pcm.sso_ondas_homologacao where cliente_id=p_cliente_id and onda=1 for share;
    if not found then raise exception 'onda_anterior_pendente' using errcode='55000'; end if;
  end if;
  insert into pcm.sso_ondas_homologacao(cliente_id,onda) values(p_cliente_id,p_onda) on conflict do nothing;
  select revisao into v_revisao from pcm.sso_ondas_homologacao where cliente_id=p_cliente_id and onda=p_onda for update;
  if v_revisao<>p_revision then raise exception 'fotografia_alterada' using errcode='40001'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_onda=2 and not exists(select 1 from pcm.sso_decisoes_onda d where d.cliente_id=p_cliente_id and d.onda=1
    and d.versao=btrim(p_versao) and d.ambiente=btrim(p_ambiente)
    and d.revisao_evidencias=(select h.revisao from pcm.sso_ondas_homologacao h where h.cliente_id=p_cliente_id and h.onda=1)) then
    raise exception 'onda_anterior_pendente' using errcode='55000'; end if;
  foreach v_cenario in array v_cts loop
    select * into v_e from pcm.sso_evidencias_ondas e where e.cliente_id=p_cliente_id and e.onda=p_onda and e.cenario=v_cenario
      and e.versao=btrim(p_versao) and e.ambiente=btrim(p_ambiente) and e.revisao<=p_revision order by e.revisao desc limit 1;
    if not found or v_e.resultado<>'passou' then raise exception 'cenario_pendente_ou_falhou' using errcode='55000'; end if;
    v_evidencias:=v_evidencias||jsonb_build_array(jsonb_build_object('cenario',v_cenario,'id',v_e.id,'revision',v_e.revisao));
  end loop;
  insert into pcm.sso_decisoes_onda(request_id,cliente_id,onda,revisao_evidencias,versao,ambiente,ator_id,ressalva,referencias,evidencias,payload)
  values(p_request_id,p_cliente_id,p_onda,p_revision,btrim(p_versao),btrim(p_ambiente),v_ator,p_ressalva,p_referencias,v_evidencias,v_payload) returning id into v_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'homologacao.onda_decidida','sso_decisoes_onda',v_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'onda',p_onda,'revision',p_revision));
  return jsonb_build_object('id',v_id,'requestId',p_request_id,'clienteId',p_cliente_id,'onda',p_onda,'revision',p_revision);
end; $$;
revoke all on function pcm.sso_registrar_decisao_onda(uuid,uuid,smallint,integer,text,text,jsonb,text) from public,anon,authenticated,service_role;
