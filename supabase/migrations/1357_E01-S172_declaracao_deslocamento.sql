-- ADR-1203: declaração de planejamento, gate fechado; não comprova deslocamento executado.
create table pcm.sso_deslocamento_declarado_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
alter table pcm.sso_deslocamento_declarado_gate enable row level security;
alter table pcm.sso_deslocamento_declarado_gate force row level security;
revoke all on pcm.sso_deslocamento_declarado_gate from public, anon, authenticated, service_role;
insert into pcm.sso_deslocamento_declarado_gate(id, habilitado) values (true, false);

create table pcm.sso_deslocamentos_declarados (
  request_id uuid primary key,
  visita_id uuid not null references pcm.visitas(id),
  cliente_id uuid not null references pcm.clientes(id),
  ator_id uuid not null references auth.users(id),
  revisao_visita integer not null check (revisao_visita > 0),
  revisao integer not null check (revisao > 0),
  minutos_por_pessoa integer not null check (minutos_por_pessoa between 0 and 10080),
  pessoas_proprias integer not null check (pessoas_proprias between 0 and 1000),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  criada_em timestamptz not null default now(),
  unique (visita_id, revisao)
);
alter table pcm.sso_deslocamentos_declarados enable row level security;
alter table pcm.sso_deslocamentos_declarados force row level security;
revoke all on pcm.sso_deslocamentos_declarados from public, anon, authenticated, service_role;
create function pcm.sso_proteger_deslocamento_declarado() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'declaracao_imutavel' using errcode = '23514';
end; $$;
revoke all on function pcm.sso_proteger_deslocamento_declarado() from public, anon, authenticated, service_role;
create trigger sso_deslocamento_declarado_imutavel before update or delete on pcm.sso_deslocamentos_declarados
  for each row execute function pcm.sso_proteger_deslocamento_declarado();

create function pcm.sso_declarar_deslocamento_visita(
  p_request_id uuid, p_cliente_id uuid, p_visita_id uuid, p_revisao_visita integer,
  p_revisao_declaracao integer, p_minutos integer, p_pessoas integer, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid(); v_visita pcm.visitas%rowtype;
  v_antiga pcm.sso_deslocamentos_declarados%rowtype; v_revisao integer;
  v_motivo text := nullif(btrim(p_motivo), ''); v_resultado jsonb;
begin
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_visita_id is null
    or p_revisao_visita is null or p_revisao_visita < 1 or p_revisao_declaracao is null or p_revisao_declaracao < 0
    or p_minutos is null or p_minutos not between 0 and 10080 or p_pessoas is null or p_pessoas not between 0 and 1000
    or v_motivo is null or length(v_motivo) > 2000 then raise exception 'declaracao_invalida' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_deslocamento_declarado_gate where id and habilitado for share;
  if not found then raise exception 'deslocamento_bloqueado' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-deslocamento-request:' || p_request_id::text, 0));
  select * into v_visita from pcm.visitas where id = p_visita_id and cliente_id = p_cliente_id for update;
  if not found then raise exception 'visita_indisponivel' using errcode = '42501'; end if;
  if exists (select 1 from pcm.sso_deslocamentos_declarados where visita_id = p_visita_id and cliente_id <> p_cliente_id) then
    raise exception 'historico_indisponivel' using errcode = '42501';
  end if;
  select * into v_antiga from pcm.sso_deslocamentos_declarados where request_id = p_request_id;
  if found then
    if v_antiga.ator_id is distinct from v_ator or v_antiga.cliente_id is distinct from p_cliente_id
      or v_antiga.visita_id is distinct from p_visita_id or v_antiga.revisao_visita is distinct from p_revisao_visita
      or v_antiga.revisao is distinct from p_revisao_declaracao + 1
      or v_antiga.minutos_por_pessoa is distinct from p_minutos or v_antiga.pessoas_proprias is distinct from p_pessoas
      or v_antiga.motivo is distinct from v_motivo then raise exception 'request_conflitante' using errcode = '23505'; end if;
    v_revisao := v_antiga.revisao;
  else
    if v_visita.revisao <> p_revisao_visita then raise exception 'revisao_visita_obsoleta' using errcode = '40001'; end if;
    select coalesce(max(revisao), 0) into v_revisao from pcm.sso_deslocamentos_declarados where visita_id = p_visita_id;
    if v_revisao <> p_revisao_declaracao then raise exception 'revisao_declaracao_obsoleta' using errcode = '40001'; end if;
    v_revisao := v_revisao + 1;
    insert into pcm.sso_deslocamentos_declarados(request_id, visita_id, cliente_id, ator_id, revisao_visita, revisao, minutos_por_pessoa, pessoas_proprias, motivo)
      values (p_request_id, p_visita_id, p_cliente_id, v_ator, p_revisao_visita, v_revisao, p_minutos, p_pessoas, v_motivo);
    insert into audit.events(actor_id, action, entity, entity_id, payload)
      values (v_ator, 'capacidade.deslocamento_declarado', 'visitas', p_visita_id,
        jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'revisaoVisita', p_revisao_visita,
          'revisao', v_revisao, 'minutosPorPessoa', p_minutos, 'pessoasProprias', p_pessoas, 'motivo', v_motivo));
  end if;
  v_resultado := jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'visitaId', p_visita_id,
    'revisaoVisita', p_revisao_visita, 'revisao', v_revisao, 'minutosPorPessoa', p_minutos,
    'pessoasProprias', p_pessoas, 'minutosHomem', p_minutos::bigint * p_pessoas::bigint, 'execucaoComprovada', false);
  return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_deslocamento_visita(uuid,uuid,uuid,integer,integer,integer,integer,text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_declarar_deslocamento_visita(uuid,uuid,uuid,integer,integer,integer,integer,text) to authenticated;

create function pcm.sso_consultar_deslocamento_visita(p_cliente_id uuid, p_visita_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_visita pcm.visitas%rowtype; v_declaracao pcm.sso_deslocamentos_declarados%rowtype;
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_deslocamento_declarado_gate where id and habilitado for share;
  if not found then raise exception 'deslocamento_bloqueado' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  select * into v_visita from pcm.visitas where id = p_visita_id and cliente_id = p_cliente_id for share;
  if not found then raise exception 'visita_indisponivel' using errcode = '42501'; end if;
  if exists (select 1 from pcm.sso_deslocamentos_declarados where visita_id = p_visita_id and cliente_id <> p_cliente_id) then
    raise exception 'historico_indisponivel' using errcode = '42501';
  end if;
  select * into v_declaracao from pcm.sso_deslocamentos_declarados
    where visita_id = p_visita_id and cliente_id = p_cliente_id order by revisao desc limit 1;
  if not found then return jsonb_build_object('clienteId', p_cliente_id, 'visitaId', p_visita_id,
    'revisaoVisitaAtual', v_visita.revisao, 'declaracao', null); end if;
  return jsonb_build_object('clienteId', p_cliente_id, 'visitaId', p_visita_id, 'revisaoVisitaAtual', v_visita.revisao,
    'declaracao', jsonb_build_object('requestId', v_declaracao.request_id, 'revisao', v_declaracao.revisao,
      'revisaoVisita', v_declaracao.revisao_visita, 'minutosPorPessoa', v_declaracao.minutos_por_pessoa,
      'pessoasProprias', v_declaracao.pessoas_proprias, 'minutosHomem', v_declaracao.minutos_por_pessoa::bigint * v_declaracao.pessoas_proprias::bigint,
      'motivo', v_declaracao.motivo, 'atorId', v_declaracao.ator_id, 'criadaEm', v_declaracao.criada_em), 'execucaoComprovada', false);
end; $$;
revoke all on function pcm.sso_consultar_deslocamento_visita(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_consultar_deslocamento_visita(uuid,uuid) to authenticated;
