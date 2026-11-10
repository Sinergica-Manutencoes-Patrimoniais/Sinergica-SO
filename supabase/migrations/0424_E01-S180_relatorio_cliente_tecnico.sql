-- ADR-0198: nenhum grant; depende do gate de relatório 0420.
create table pcm.sso_despesa_atribuicoes_tecnico (
  despesa_id uuid not null references pcm.despesas_visita(id), revisao integer not null check (revisao > 1),
  participacao_id uuid references pcm.visita_equipes(id), motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  ator_id uuid not null references auth.users(id), request_id uuid not null unique, criado_em timestamptz not null default now(),
  primary key (despesa_id, revisao)
);
alter table pcm.sso_despesa_atribuicoes_tecnico enable row level security;
alter table pcm.sso_despesa_atribuicoes_tecnico force row level security;
revoke all on pcm.sso_despesa_atribuicoes_tecnico from public, anon, authenticated, service_role;

create function pcm.sso_atribuir_tecnico_despesa(p_request_id uuid, p_despesa_id uuid,
  p_expected_revision integer, p_participacao_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_despesa pcm.despesas_visita%rowtype; v_comando pcm.despesa_visita_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_despesa_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'atribuir_tecnico', 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'participacaoId', p_participacao_id, 'motivo', btrim(p_motivo));
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if not coalesce((select habilitado from pcm.sso_resumo_despesa_gate where id), false) then
    raise exception 'relatorio_indisponivel' using errcode = '55000'; end if;
  if v_despesa.revisao <> p_expected_revision or v_despesa.status <> 'ativa' then
    raise exception 'revisao_ou_estado_invalido' using errcode = '40001'; end if;
  if p_participacao_id is not null then
    perform 1 from pcm.visita_equipes e where e.id = p_participacao_id and e.visita_id = v_despesa.visita_id
      and e.cliente_id = v_despesa.cliente_id and e.encerrado_em is null for share;
    if not found then raise exception 'participacao_invalida' using errcode = '23514'; end if;
  end if;
  update pcm.despesas_visita set revisao = revisao + 1 where id = p_despesa_id returning * into v_despesa;
  insert into pcm.sso_despesa_atribuicoes_tecnico(despesa_id, revisao, participacao_id, motivo, ator_id, request_id)
    values (p_despesa_id, v_despesa.revisao, p_participacao_id, btrim(p_motivo), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'despesa_visita.tecnico_atribuido', 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id, 'revision', v_despesa.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', v_despesa.revisao,
    'state', v_despesa.status, 'requestId', p_request_id, 'linkedIds', jsonb_build_object('visitaId', v_despesa.visita_id));
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, auth.uid(), v_despesa.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_atribuir_tecnico_despesa(uuid, uuid, integer, uuid, text) from public, anon, authenticated, service_role;

create function pcm.sso_tecnicos_despesa_visita(p_cliente_id uuid, p_visita_id uuid, p_apos uuid default null)
returns table(id uuid, nome text) language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null
    or config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is not true
    or not exists (select 1 from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select habilitado from pcm.sso_resumo_despesa_gate where id), false) then raise exception 'relatorio_indisponivel' using errcode = '55000'; end if;
  return query select e.id, f.nome from pcm.visita_equipes e join pcm.funcionarios f on f.id = e.funcionario_id
    where e.cliente_id = p_cliente_id and e.visita_id = p_visita_id and e.encerrado_em is null
      and (p_apos is null or e.id > p_apos) order by e.id limit 20;
end;
$$;
revoke all on function pcm.sso_tecnicos_despesa_visita(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create function pcm.sso_atribuicao_tecnico_despesa(p_despesa_id uuid)
returns table(participacao_id uuid, tecnico_nome text, vigente boolean, revisao integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_despesa pcm.despesas_visita%rowtype;
begin
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select habilitado from pcm.sso_resumo_despesa_gate where id), false) then raise exception 'relatorio_indisponivel' using errcode = '55000'; end if;
  return query select a.participacao_id, f.nome, case when a.participacao_id is null then null else e.encerrado_em is null end, a.revisao
    from pcm.sso_despesa_atribuicoes_tecnico a
    left join pcm.visita_equipes e on e.id = a.participacao_id and e.visita_id = v_despesa.visita_id and e.cliente_id = v_despesa.cliente_id
    left join pcm.funcionarios f on f.id = e.funcionario_id
    where a.despesa_id = p_despesa_id order by a.revisao desc limit 1;
end;
$$;
revoke all on function pcm.sso_atribuicao_tecnico_despesa(uuid) from public, anon, authenticated, service_role;

create function pcm.sso_relatorio_despesas_cliente(p_cliente_id uuid, p_inicio date, p_fim date)
returns table(tecnico_id uuid, tecnico_nome text, quantidade bigint, previsto_centavos numeric,
  realizado_centavos numeric, sem_realizado bigint, atribuicoes_historicas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim)
    or p_inicio > p_fim or p_fim - p_inicio > 730 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is not true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if not coalesce((select habilitado from pcm.sso_resumo_despesa_gate where id), false) then raise exception 'relatorio_indisponivel' using errcode = '55000'; end if;
  if exists (select 1 from pcm.despesas_visita d where d.cliente_id = p_cliente_id and d.status = 'ativa' and d.data between p_inicio and p_fim
    having coalesce(sum(d.previsto_centavos), 0) > 9007199254740991 or coalesce(sum(d.realizado_centavos), 0) > 9007199254740991) then
    raise exception 'total_excede_limite' using errcode = '22003'; end if;
  if exists (select 1 from pcm.despesas_visita d
    join lateral (select a.participacao_id from pcm.sso_despesa_atribuicoes_tecnico a
      where a.despesa_id = d.id order by a.revisao desc limit 1) atribuicao on true
    where d.cliente_id = p_cliente_id and d.status = 'ativa' and d.data between p_inicio and p_fim
      and atribuicao.participacao_id is not null and not exists (select 1 from pcm.visita_equipes e
        where e.id = atribuicao.participacao_id and e.visita_id = d.visita_id and e.cliente_id = d.cliente_id)) then
    raise exception 'atribuicao_inconsistente' using errcode = '23514'; end if;
  return query select f.id, f.nome, count(*), coalesce(sum(d.previsto_centavos), 0), coalesce(sum(d.realizado_centavos), 0),
    count(*) filter (where d.realizado_centavos is null), count(*) filter (where e.encerrado_em is not null)
    from pcm.despesas_visita d
    left join lateral (select a.participacao_id from pcm.sso_despesa_atribuicoes_tecnico a
      where a.despesa_id = d.id order by a.revisao desc limit 1) atribuicao on true
    left join pcm.visita_equipes e on e.id = atribuicao.participacao_id and e.visita_id = d.visita_id and e.cliente_id = d.cliente_id
    left join pcm.funcionarios f on f.id = e.funcionario_id
    where d.cliente_id = p_cliente_id and d.status = 'ativa' and d.data between p_inicio and p_fim
    group by f.id, f.nome order by f.nome nulls last, f.id nulls last;
end;
$$;
revoke all on function pcm.sso_relatorio_despesas_cliente(uuid, date, date) from public, anon, authenticated, service_role;
