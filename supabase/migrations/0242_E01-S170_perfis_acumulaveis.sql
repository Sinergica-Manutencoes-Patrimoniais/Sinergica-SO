-- E01-S170: perfis de capacidades e vínculos múltiplos, com revisão e auditoria.
-- Reverso: desabilitar consumidores e preservar registros e auditoria antes de remover RPCs.
alter table config.sso_usuario_perfis add column if not exists id uuid default gen_random_uuid();
alter table config.sso_usuario_perfis alter column id set not null;
create unique index if not exists idx_sso_usuario_perfis_id on config.sso_usuario_perfis(id);

-- Helpers internos só são executáveis pelo owner das RPCs; requestId é global entre comandos.
create or replace function config.sso_inicio_comando(p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_comando config.sso_comandos%rowtype;
begin
  if not exists (select 1 from config.usuarios u where u.user_id = auth.uid()
    and u.ativo and u.papel = 'superadmin' and auth.jwt() ->> 'user_role' = 'superadmin') then
    raise exception 'sem_permissao_para_configurar' using errcode = '42501';
  end if;
  if p_request_id is null or p_payload is null then raise exception 'comando_invalido' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_comando from config.sso_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from auth.uid() or v_comando.payload is distinct from p_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  return null;
end;
$$;
revoke all on function config.sso_inicio_comando(uuid, jsonb) from public, anon, authenticated, service_role;

create or replace function config.sso_registrar_comando(
  p_request_id uuid, p_payload jsonb, p_resultado jsonb, p_acao text, p_entidade text,
  p_entidade_id uuid, p_antes jsonb, p_depois jsonb, p_motivo text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into audit.events(actor_id, action, entity, entity_id, payload)
  values (auth.uid(), p_acao, p_entidade, p_entidade_id,
    jsonb_build_object('requestId', p_request_id, 'motivo', p_motivo, 'antes', p_antes, 'depois', p_depois));
  insert into config.sso_comandos(request_id, actor_id, payload, resultado)
  values (p_request_id, auth.uid(), p_payload, p_resultado);
end;
$$;
revoke all on function config.sso_registrar_comando(uuid, jsonb, jsonb, text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated, service_role;

create or replace function config.sso_definir_perfil(
  p_request_id uuid, p_expected_revision integer, p_perfil_id uuid,
  p_nome text, p_ativo boolean, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := nullif(btrim(p_nome), '');
  v_motivo text := nullif(btrim(p_motivo), '');
  v_payload jsonb;
  v_resultado jsonb;
  v_anterior config.sso_perfis%rowtype;
  v_atual config.sso_perfis%rowtype;
begin
  if p_perfil_id is null or p_expected_revision is null or p_expected_revision < 0
    or v_nome is null or length(v_nome) > 120 or p_ativo is null
    or v_motivo is null or length(v_motivo) > 1000 then
    raise exception 'perfil_invalido' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'perfil', 'expectedRevision', p_expected_revision,
    'perfilId', p_perfil_id, 'nome', v_nome, 'ativo', p_ativo, 'motivo', v_motivo);
  v_resultado := config.sso_inicio_comando(p_request_id, v_payload);
  if v_resultado is not null then return v_resultado; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso_perfil:' || p_perfil_id::text, 0));
  select * into v_anterior from config.sso_perfis where id = p_perfil_id for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    if not p_ativo then raise exception 'perfil_inexistente' using errcode = '22023'; end if;
    insert into config.sso_perfis(id, nome, ativo, revisao)
      values (p_perfil_id, v_nome, true, 1) returning * into v_atual;
  else
    if v_anterior.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    update config.sso_perfis set nome = v_nome, ativo = p_ativo, revisao = revisao + 1
      where id = p_perfil_id returning * into v_atual;
  end if;
  v_resultado := jsonb_build_object('aggregateId', v_atual.id, 'revision', v_atual.revisao,
    'state', v_atual.ativo, 'created', v_anterior.id is null, 'linkedIds', jsonb_build_object(),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  perform config.sso_registrar_comando(p_request_id, v_payload, v_resultado, 'perfil.definido', 'sso_perfis',
    v_atual.id, case when v_anterior.id is null then null else to_jsonb(v_anterior) end, to_jsonb(v_atual), v_motivo);
  return v_resultado;
end;
$$;
revoke all on function config.sso_definir_perfil(uuid, integer, uuid, text, boolean, text) from public, anon;
grant execute on function config.sso_definir_perfil(uuid, integer, uuid, text, boolean, text) to authenticated;

create or replace function config.sso_definir_vinculo_perfil(
  p_request_id uuid, p_expected_revision integer, p_usuario_id uuid, p_perfil_id uuid,
  p_ativo boolean, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_motivo text := nullif(btrim(p_motivo), '');
  v_payload jsonb;
  v_resultado jsonb;
  v_anterior config.sso_usuario_perfis%rowtype;
  v_atual config.sso_usuario_perfis%rowtype;
begin
  if p_usuario_id is null or p_perfil_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_ativo is null or v_motivo is null or length(v_motivo) > 1000 then
    raise exception 'vinculo_invalido' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'vinculoPerfil', 'expectedRevision', p_expected_revision,
    'usuarioId', p_usuario_id, 'perfilId', p_perfil_id, 'ativo', p_ativo, 'motivo', v_motivo);
  v_resultado := config.sso_inicio_comando(p_request_id, v_payload);
  if v_resultado is not null then return v_resultado; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso_vinculo:' || p_usuario_id::text || ':' || p_perfil_id::text, 0));
  if p_ativo and (not exists (select 1 from config.usuarios u where u.user_id = p_usuario_id and u.ativo and u.papel <> 'cliente-sindico')
    or not exists (select 1 from config.sso_perfis p where p.id = p_perfil_id and p.ativo)) then
    raise exception 'usuario_ou_perfil_indisponivel' using errcode = '22023';
  end if;
  select * into v_anterior from config.sso_usuario_perfis
    where usuario_id = p_usuario_id and perfil_id = p_perfil_id for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    if not p_ativo then raise exception 'vinculo_inexistente' using errcode = '22023'; end if;
    insert into config.sso_usuario_perfis(usuario_id, perfil_id, ativo, revisao)
      values (p_usuario_id, p_perfil_id, true, 1) returning * into v_atual;
  else
    if v_anterior.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
    update config.sso_usuario_perfis set ativo = p_ativo, revisao = revisao + 1
      where usuario_id = p_usuario_id and perfil_id = p_perfil_id returning * into v_atual;
  end if;
  v_resultado := jsonb_build_object('aggregateId', v_atual.id, 'revision', v_atual.revisao,
    'state', v_atual.ativo, 'created', v_anterior.id is null,
    'linkedIds', jsonb_build_object('usuarioId', p_usuario_id, 'perfilId', p_perfil_id),
    'warnings', jsonb_build_array(), 'requestId', p_request_id);
  perform config.sso_registrar_comando(p_request_id, v_payload, v_resultado, 'perfil.vinculo_definido', 'sso_usuario_perfis',
    v_atual.id, case when v_anterior.id is null then null else to_jsonb(v_anterior) end, to_jsonb(v_atual), v_motivo);
  return v_resultado;
end;
$$;
revoke all on function config.sso_definir_vinculo_perfil(uuid, integer, uuid, uuid, boolean, text) from public, anon;
grant execute on function config.sso_definir_vinculo_perfil(uuid, integer, uuid, uuid, boolean, text) to authenticated;
