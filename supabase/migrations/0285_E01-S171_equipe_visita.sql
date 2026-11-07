-- ADR-0061: equipe com histórico, sem alterar agenda ou integração externa.
create table pcm.visita_equipes (
  id uuid primary key,
  visita_id uuid not null,
  cliente_id uuid not null references pcm.clientes(id),
  funcionario_id uuid not null references pcm.funcionarios(id),
  papel text not null check (length(btrim(papel)) between 1 and 120),
  estimativa_minutos integer check (estimativa_minutos is null or estimativa_minutos > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  encerrado_em timestamptz,
  encerrado_por uuid references auth.users(id),
  encerramento_motivo text,
  foreign key (visita_id, cliente_id) references pcm.visitas(id, cliente_id),
  check ((encerrado_em is null and encerrado_por is null and encerramento_motivo is null)
    or (encerrado_em is not null and encerrado_por is not null and nullif(btrim(encerramento_motivo), '') is not null)),
  check (encerrado_em is null or encerrado_em >= created_at)
);
create unique index uq_visita_funcionario_vigente on pcm.visita_equipes(visita_id, funcionario_id) where encerrado_em is null;
create index idx_visita_equipe_visita on pcm.visita_equipes(visita_id, id);
alter table pcm.visita_equipes enable row level security;
alter table pcm.visita_equipes force row level security;
revoke all on pcm.visita_equipes from public, anon, authenticated, service_role;
grant select on pcm.visita_equipes to authenticated;
create policy visita_equipe_leitura_capacidade on pcm.visita_equipes for select to authenticated
  using (config.sso_autorizar_acao('visita.confirmar', cliente_id));

create function pcm.sso_proteger_historico_visita_equipe() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'participacao_visita_imutavel' using errcode = '23514'; end if;
  if old.encerrado_em is not null or new.encerrado_em is null
    or (to_jsonb(new) - array['encerrado_em', 'encerrado_por', 'encerramento_motivo'])
      is distinct from (to_jsonb(old) - array['encerrado_em', 'encerrado_por', 'encerramento_motivo']) then
    raise exception 'participacao_visita_imutavel' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_historico_visita_equipe() from public, anon, authenticated, service_role;
create trigger sso_visita_equipe_historico before update or delete on pcm.visita_equipes
for each row execute function pcm.sso_proteger_historico_visita_equipe();

create function pcm.sso_adicionar_membro_visita(
  p_request_id uuid, p_expected_revision integer, p_visita_id uuid, p_funcionario_id uuid,
  p_participacao_id uuid, p_papel text, p_estimativa_minutos integer
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid(); v_antes pcm.visitas%rowtype; v_visita pcm.visitas%rowtype;
  v_comando pcm.visita_comandos%rowtype; v_participacao pcm.visita_equipes%rowtype;
  v_payload jsonb; v_resultado jsonb; v_papel text := nullif(btrim(p_papel), '');
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_visita_id is null
    or p_funcionario_id is null or p_participacao_id is null or v_papel is null or length(v_papel) > 120
    or (p_estimativa_minutos is not null and p_estimativa_minutos <= 0) then
    raise exception 'participacao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'adicionarMembroVisita', 'expectedRevision', p_expected_revision,
    'visitaId', p_visita_id, 'funcionarioId', p_funcionario_id, 'participacaoId', p_participacao_id,
    'papel', v_papel, 'estimativaMinutos', p_estimativa_minutos);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-request:' || p_request_id::text, 0));
  select * into v_antes from pcm.visitas where id = p_visita_id for update;
  if not found or not config.sso_autorizar_acao('visita.confirmar', v_antes.cliente_id) then
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
  if v_antes.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_antes.estado not in ('rascunho', 'planejada') then raise exception 'visita_nao_editavel' using errcode = '22023'; end if;
  perform 1 from pcm.funcionarios f where f.id = p_funcionario_id and f.ativo and f.deleted_at is null for share;
  if not found then raise exception 'funcionario_invalido' using errcode = '23514'; end if;
  insert into pcm.visita_equipes(id, visita_id, cliente_id, funcionario_id, papel, estimativa_minutos, created_by)
    values (p_participacao_id, p_visita_id, v_antes.cliente_id, p_funcionario_id, v_papel, p_estimativa_minutos, v_actor)
    returning * into v_participacao;
  update pcm.visitas set revisao = revisao + 1, updated_at = now(), updated_by = v_actor
    where id = p_visita_id returning * into v_visita;
  v_resultado := jsonb_build_object('aggregateId', p_visita_id, 'revision', v_visita.revisao, 'state', v_visita.estado,
    'created', false, 'linkedIds', jsonb_build_object('clienteId', v_visita.cliente_id,
      'funcionarioId', p_funcionario_id, 'participacaoId', p_participacao_id), 'warnings', jsonb_build_array(), 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'visita.membro_adicionado', 'visitas', p_visita_id,
      jsonb_build_object('requestId', p_request_id, 'antes', to_jsonb(v_antes), 'depois', to_jsonb(v_visita), 'participacao', to_jsonb(v_participacao)));
  insert into pcm.visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_visita.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_adicionar_membro_visita(uuid, integer, uuid, uuid, uuid, text, integer) from public, anon;
grant execute on function pcm.sso_adicionar_membro_visita(uuid, integer, uuid, uuid, uuid, text, integer) to authenticated;
