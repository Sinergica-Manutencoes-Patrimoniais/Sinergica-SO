-- ADR-0040: versão inicial e Rotinas, sem execução e sem alterar preventivas legadas.
create table pcm.plano_versoes (
  id uuid primary key default gen_random_uuid(), plano_id uuid not null references pcm.planos_manutencao(id),
  numero integer not null check (numero > 0), estado text not null default 'rascunho' check (estado in ('rascunho', 'aprovado')),
  vigencia_inicio date, vigencia_fim date, aprovada_em timestamptz, aprovada_por uuid references auth.users(id),
  created_at timestamptz not null default now(), created_by uuid not null references auth.users(id),
  unique(plano_id, numero), unique(id, plano_id),
  check (vigencia_fim is null or (vigencia_inicio is not null and vigencia_fim >= vigencia_inicio))
);
create unique index uq_plano_versao_rascunho on pcm.plano_versoes(plano_id) where estado = 'rascunho';
alter table pcm.plano_versoes enable row level security;
alter table pcm.plano_versoes force row level security;
grant select on pcm.plano_versoes to authenticated;
create policy plano_versoes_gestor_read on pcm.plano_versoes for select to authenticated
  using (exists (select 1 from pcm.planos_manutencao p where p.id = plano_id and config.sso_autorizar_acao('plano.gerir', p.cliente_id)));

create table pcm.rotinas_manutencao (
  id uuid primary key, rotina_logica_id uuid not null, plano_id uuid not null, versao_id uuid not null,
  nome text not null check (length(btrim(nome)) between 1 and 200),
  alvo_tipo text not null check (alvo_tipo in ('sistema', 'componente', 'grupo')),
  sistema_id uuid references pcm.sistemas(id), equipamento_id uuid references pcm.equipamentos(id), grupo_id uuid references pcm.grupos_quantitativos(id),
  modo text not null check (modo in ('calendario', 'visita')), intervalo_n integer check (intervalo_n > 0),
  intervalo_unidade text check (intervalo_unidade in ('dias', 'semanas', 'meses', 'anos')),
  data_base date, tempo_minutos integer check (tempo_minutos >= 0),
  tolerancia_antes integer not null default 0 check (tolerancia_antes >= 0),
  tolerancia_depois integer not null default 0 check (tolerancia_depois >= 0),
  created_at timestamptz not null default now(), created_by uuid not null references auth.users(id),
  foreign key (versao_id, plano_id) references pcm.plano_versoes(id, plano_id),
  unique(versao_id, rotina_logica_id),
  check ((intervalo_n is null) = (intervalo_unidade is null)),
  check (num_nonnulls(sistema_id, equipamento_id, grupo_id) = 1),
  check ((alvo_tipo = 'sistema' and sistema_id is not null) or (alvo_tipo = 'componente' and equipamento_id is not null) or (alvo_tipo = 'grupo' and grupo_id is not null))
);
create index idx_rotinas_plano on pcm.rotinas_manutencao(plano_id, versao_id, id);
create index idx_rotinas_sistema on pcm.rotinas_manutencao(sistema_id) where sistema_id is not null;
create index idx_rotinas_equipamento on pcm.rotinas_manutencao(equipamento_id) where equipamento_id is not null;
create index idx_rotinas_grupo on pcm.rotinas_manutencao(grupo_id) where grupo_id is not null;
alter table pcm.rotinas_manutencao enable row level security;
alter table pcm.rotinas_manutencao force row level security;
grant select on pcm.rotinas_manutencao to authenticated;
create policy rotinas_gestor_read on pcm.rotinas_manutencao for select to authenticated
  using (exists (select 1 from pcm.planos_manutencao p where p.id = plano_id and config.sso_autorizar_acao('plano.gerir', p.cliente_id)));

create function pcm.sso_adicionar_rotina_rascunho(p_request_id uuid, p_expected_revision integer,
  p_plano_id uuid, p_rotina_id uuid, p_nome text, p_alvo_tipo text, p_alvo_id uuid,
  p_modo text, p_intervalo integer, p_unidade text, p_data_base date, p_tempo_minutos integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_plano pcm.planos_manutencao%rowtype; v_versao uuid; v_cliente_alvo uuid;
  v_comando pcm.plano_comandos%rowtype; v_payload jsonb; v_resultado jsonb; v_rotina pcm.rotinas_manutencao%rowtype;
  v_nome text := nullif(btrim(p_nome), '');
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_plano_id is null or p_rotina_id is null
    or v_nome is null or length(v_nome) > 200 or p_alvo_tipo is null or p_alvo_tipo not in ('sistema', 'componente', 'grupo')
    or p_alvo_id is null or p_modo is null or p_modo not in ('calendario', 'visita')
    or (p_intervalo is null) <> (p_unidade is null) or (p_intervalo is not null and p_intervalo < 1)
    or (p_unidade is not null and p_unidade not in ('dias', 'semanas', 'meses', 'anos'))
    or (p_tempo_minutos is not null and p_tempo_minutos < 0) then raise exception 'rotina_invalida' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('tipo', 'adicionarRotina', 'expectedRevision', p_expected_revision,
    'planoId', p_plano_id, 'rotinaId', p_rotina_id, 'nome', v_nome, 'alvoTipo', p_alvo_tipo, 'alvoId', p_alvo_id,
    'modo', p_modo, 'intervalo', p_intervalo, 'unidade', p_unidade, 'dataBase', p_data_base, 'tempoMinutos', p_tempo_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:' || p_request_id::text, 0));
  select * into v_plano from pcm.planos_manutencao where id = p_plano_id for update;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_plano.cliente_id) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.plano_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_plano.estado <> 'rascunho' then raise exception 'plano_nao_editavel' using errcode = '22023'; end if;
  if v_plano.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if p_alvo_tipo = 'sistema' then
    select s.cliente_id into v_cliente_alvo from pcm.sistemas s where s.id = p_alvo_id and s.ativo and s.deleted_at is null for share;
  elsif p_alvo_tipo = 'componente' then
    select e.client_id into v_cliente_alvo from pcm.equipamentos e where e.id = p_alvo_id and e.ativo and e.deleted_at is null for share;
  else
    select g.cliente_id into v_cliente_alvo from pcm.grupos_quantitativos g where g.id = p_alvo_id and g.ativo and g.deleted_at is null for share;
  end if;
  if v_cliente_alvo is distinct from v_plano.cliente_id then raise exception 'alvo_invalido_ou_de_outro_cliente' using errcode = '23514'; end if;
  select id into v_versao from pcm.plano_versoes where plano_id = p_plano_id and estado = 'rascunho';
  if v_versao is null then
    insert into pcm.plano_versoes(plano_id, numero, created_by) values (p_plano_id, 1, v_actor) returning id into v_versao;
  end if;
  insert into pcm.rotinas_manutencao(id, rotina_logica_id, plano_id, versao_id, nome, alvo_tipo,
    sistema_id, equipamento_id, grupo_id, modo, intervalo_n, intervalo_unidade, data_base, tempo_minutos, created_by)
    values (p_rotina_id, p_rotina_id, p_plano_id, v_versao, v_nome, p_alvo_tipo,
      case when p_alvo_tipo = 'sistema' then p_alvo_id end, case when p_alvo_tipo = 'componente' then p_alvo_id end,
      case when p_alvo_tipo = 'grupo' then p_alvo_id end, p_modo, p_intervalo, p_unidade, p_data_base, p_tempo_minutos, v_actor)
    returning * into v_rotina;
  update pcm.planos_manutencao set revisao = revisao + 1, updated_at = now(), updated_by = v_actor where id = p_plano_id returning * into v_plano;
  v_resultado := jsonb_build_object('aggregateId', p_plano_id, 'revision', v_plano.revisao, 'state', v_plano.estado,
    'created', true, 'linkedIds', jsonb_build_object('clienteId', v_plano.cliente_id, 'versaoId', v_versao, 'rotinaId', p_rotina_id),
    'warnings', case when coalesce(p_tempo_minutos, 0) = 0 then jsonb_build_array('tempo_a_validar') else jsonb_build_array() end,
    'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'rotina.rascunho_criada', 'rotinas_manutencao', p_rotina_id,
      jsonb_build_object('requestId', p_request_id, 'planoId', p_plano_id, 'revision', v_plano.revisao, 'depois', to_jsonb(v_rotina)));
  insert into pcm.plano_comandos(request_id, actor_id, cliente_id, payload, resultado) values (p_request_id, v_actor, v_plano.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_adicionar_rotina_rascunho(uuid, integer, uuid, uuid, text, text, uuid, text, integer, text, date, integer) from public, anon;
grant execute on function pcm.sso_adicionar_rotina_rascunho(uuid, integer, uuid, uuid, text, text, uuid, text, integer, text, date, integer) to authenticated;

create function pcm.sso_proteger_cliente_alvo_rotina() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid; v_uso boolean;
begin
  if tg_table_name = 'equipamentos' then
    v_cliente := new.client_id;
    select exists(select 1 from pcm.rotinas_manutencao r join pcm.planos_manutencao p on p.id = r.plano_id where r.equipamento_id = old.id and p.cliente_id is distinct from v_cliente) into v_uso;
  elsif tg_table_name = 'sistemas' then
    v_cliente := new.cliente_id;
    select exists(select 1 from pcm.rotinas_manutencao r join pcm.planos_manutencao p on p.id = r.plano_id where r.sistema_id = old.id and p.cliente_id is distinct from v_cliente) into v_uso;
  else
    v_cliente := new.cliente_id;
    select exists(select 1 from pcm.rotinas_manutencao r join pcm.planos_manutencao p on p.id = r.plano_id where r.grupo_id = old.id and p.cliente_id is distinct from v_cliente) into v_uso;
  end if;
  if v_uso then raise exception 'alvo_em_plano_de_outro_cliente' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_cliente_alvo_rotina() from public, anon, authenticated, service_role;
create trigger zzz_equipamento_cliente_rotina before update of client_id on pcm.equipamentos
for each row when (old.client_id is distinct from new.client_id) execute function pcm.sso_proteger_cliente_alvo_rotina();
create trigger zzz_sistema_cliente_rotina before update of cliente_id on pcm.sistemas
for each row when (old.cliente_id is distinct from new.cliente_id) execute function pcm.sso_proteger_cliente_alvo_rotina();
create trigger sso_grupo_cliente_rotina before update of cliente_id on pcm.grupos_quantitativos
for each row when (old.cliente_id is distinct from new.cliente_id) execute function pcm.sso_proteger_cliente_alvo_rotina();
