-- ADR-0067: confirmação PCM sem envio, com snapshot de política.
create table pcm.visita_confirmacoes (
  id uuid primary key,
  visita_id uuid not null,
  cliente_id uuid not null,
  revisao integer not null check (revisao > 0),
  politica_modo text not null check (politica_modo in ('sem_controle', 'informativa', 'obrigatoria')),
  politica_origem text not null check (politica_origem in ('padrao', 'cliente', 'contrato', 'visita')),
  politica_id uuid references pcm.politicas_ciencia_visita(id),
  politica_revisao integer,
  confirmado_por uuid not null references auth.users(id),
  confirmado_em timestamptz not null default now(),
  foreign key (visita_id, cliente_id) references pcm.visitas(id, cliente_id),
  unique (visita_id, revisao),
  check ((politica_id is null and politica_revisao is null and politica_origem = 'padrao')
    or (politica_id is not null and politica_revisao > 0 and politica_origem <> 'padrao'))
);
alter table pcm.visita_confirmacoes enable row level security;
alter table pcm.visita_confirmacoes force row level security;
revoke all on pcm.visita_confirmacoes from public, anon, authenticated, service_role;
grant select on pcm.visita_confirmacoes to authenticated;
create policy visita_confirmacoes_leitura on pcm.visita_confirmacoes for select to authenticated
  using (config.sso_autorizar_acao('visita.confirmar', cliente_id));
create function pcm.sso_proteger_confirmacao_visita() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'confirmacao_visita_imutavel' using errcode = '23514'; end;
$$;
revoke all on function pcm.sso_proteger_confirmacao_visita() from public, anon, authenticated, service_role;
create trigger sso_confirmacao_visita_imutavel before update or delete on pcm.visita_confirmacoes
for each row execute function pcm.sso_proteger_confirmacao_visita();

create function pcm.sso_confirmar_visita(p_request_id uuid, p_expected_revision integer, p_visita_id uuid)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_previa pcm.visitas%rowtype; v_antes pcm.visitas%rowtype; v_visita pcm.visitas%rowtype;
  v_politica pcm.politicas_ciencia_visita%rowtype; v_origem text; v_modo text;
  v_comando pcm.visita_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_visita_id is null then
    raise exception 'confirmacao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'confirmarVisita', 'expectedRevision', p_expected_revision, 'visitaId', p_visita_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:' || p_request_id::text, 0));
  select * into v_previa from pcm.visitas where id = p_visita_id;
  if not found or not config.sso_autorizar_acao('visita.confirmar', v_previa.cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('visita.confirmar', v_comando.cliente_id) then
      raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:' || v_previa.cliente_id::text || ':-:-', 0));
  if v_previa.contrato_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:' || v_previa.cliente_id::text || ':' || v_previa.contrato_id::text || ':-', 0));
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ciencia-scope:' || v_previa.cliente_id::text || ':-:' || p_visita_id::text, 0));
  select * into v_antes from pcm.visitas where id = p_visita_id for update;
  if not found or not config.sso_autorizar_acao('visita.confirmar', v_antes.cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_antes.cliente_id is distinct from v_previa.cliente_id or v_antes.contrato_id is distinct from v_previa.contrato_id then
    raise exception 'escopo_alterado' using errcode = '40001';
  end if;
  if v_antes.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_antes.estado <> 'planejada' then raise exception 'transicao_invalida' using errcode = '22023'; end if;
  if v_antes.responsavel_id is null then raise exception 'responsavel_ausente' using errcode = '23514'; end if;
  perform 1 from pcm.funcionarios f where f.id = v_antes.responsavel_id and f.ativo and f.deleted_at is null for share;
  if not found then raise exception 'responsavel_invalido' using errcode = '23514'; end if;
  if not exists (select 1 from pcm.visita_ordens_servico where visita_id = p_visita_id and encerrado_em is null)
    or not exists (select 1 from pcm.visita_equipes where visita_id = p_visita_id and encerrado_em is null) then
    raise exception 'visita_incompleta' using errcode = '23514';
  end if;
  perform f.id from pcm.funcionarios f join pcm.visita_equipes e on e.funcionario_id = f.id
    where e.visita_id = p_visita_id and e.encerrado_em is null order by f.id for share of f;
  if exists (select 1 from pcm.visita_equipes e join pcm.funcionarios f on f.id = e.funcionario_id
    where e.visita_id = p_visita_id and e.encerrado_em is null and (not f.ativo or f.deleted_at is not null)) then
    raise exception 'equipe_inativa' using errcode = '23514';
  end if;
  select p.* into v_politica from pcm.politicas_ciencia_visita p where p.cliente_id = v_antes.cliente_id and
    (p.visita_id = p_visita_id or (p.visita_id is null and p.contrato_id = v_antes.contrato_id and v_antes.contrato_id is not null)
      or (p.visita_id is null and p.contrato_id is null))
    order by case when p.visita_id is not null then 1 when p.contrato_id is not null then 2 else 3 end limit 1;
  if found then
    v_modo := v_politica.modo;
    v_origem := case when v_politica.visita_id is not null then 'visita' when v_politica.contrato_id is not null then 'contrato' else 'cliente' end;
  else v_modo := 'sem_controle'; v_origem := 'padrao'; end if;
  update pcm.visitas set estado = 'confirmada', revisao = revisao + 1, updated_at = now(), updated_by = v_actor
    where id = p_visita_id returning * into v_visita;
  insert into pcm.visita_confirmacoes(id, visita_id, cliente_id, revisao, politica_modo, politica_origem, politica_id, politica_revisao, confirmado_por)
    values (p_request_id, p_visita_id, v_visita.cliente_id, v_visita.revisao, v_modo, v_origem, v_politica.id, v_politica.revisao, v_actor);
  v_resultado := jsonb_build_object('aggregateId', p_visita_id, 'revision', v_visita.revisao, 'state', v_visita.estado,
    'created', false, 'linkedIds', jsonb_build_object('clienteId', v_visita.cliente_id, 'confirmacaoId', p_request_id),
    'warnings', case when v_modo = 'obrigatoria' then jsonb_build_array('ciencia_cliente_exigida_antes_envio') else jsonb_build_array() end, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'visita.confirmada', 'visitas', p_visita_id, jsonb_build_object('requestId', p_request_id,
      'antes', to_jsonb(v_antes), 'depois', to_jsonb(v_visita), 'politicaModo', v_modo, 'politicaOrigem', v_origem,
      'politicaId', v_politica.id, 'politicaRevisao', v_politica.revisao));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_visita.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_confirmar_visita(uuid, integer, uuid) from public, anon;
grant execute on function pcm.sso_confirmar_visita(uuid, integer, uuid) to authenticated;
