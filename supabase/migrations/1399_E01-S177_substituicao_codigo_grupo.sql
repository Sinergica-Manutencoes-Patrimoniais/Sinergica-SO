-- ADR-1246: comando privado; não conceder nem conectar antes dos gates.
create function pcm.sso_substituir_codigo_grupo_privado(
  p_request_id uuid, p_grupo_id uuid, p_codigo_anterior text, p_codigo_novo text, p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_cliente uuid;
  v_atual pcm.sso_codigos_grupo_quantitativo%rowtype;
  v_comando pcm.sso_codigo_comandos%rowtype;
  v_payload jsonb;
  v_resultado jsonb;
  v_novo uuid;
begin
  if v_ator is null or p_request_id is null or p_grupo_id is null or p_codigo_anterior is null
    or length(p_codigo_anterior) not between 1 and 200 or p_codigo_novo is null
    or length(p_codigo_novo) not between 1 and 200 or p_codigo_novo <> upper(btrim(p_codigo_novo))
    or p_codigo_novo ~ '[[:space:]]' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'substituicao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'grupo_quantitativo', 'ativoId', p_grupo_id,
    'codigoAnterior', p_codigo_anterior, 'codigoNovo', p_codigo_novo, 'motivo', btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('codigo-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.sso_codigo_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or config.sso_autorizar_acao('codigo.substituir', v_comando.cliente_id) is not true
      or not exists (select 1 from config.usuarios u where u.user_id = v_ator and u.ativo and u.papel = 'superadmin' and auth.jwt()->>'user_role' = 'superadmin') then
      raise exception 'codigo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0));
  select cliente_id into v_cliente from pcm.grupos_quantitativos where id = p_grupo_id and deleted_at is null for update;
  if v_cliente is null or config.sso_autorizar_acao('codigo.substituir', v_cliente) is not true
    or not exists (select 1 from config.usuarios u where u.user_id = v_ator and u.ativo and u.papel = 'superadmin' and auth.jwt()->>'user_role' = 'superadmin') then
    raise exception 'codigo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_atual from pcm.sso_codigos_grupo_quantitativo where grupo_id = p_grupo_id and cliente_id = v_cliente and atual for update;
  if not found or v_atual.codigo is distinct from p_codigo_anterior then raise exception 'codigo_anterior_divergente' using errcode = '40001'; end if;
  if upper(btrim(p_codigo_anterior)) = p_codigo_novo then raise exception 'codigo_sem_alteracao' using errcode = '22023'; end if;
  if exists (select 1 from pcm.sso_codigos_grupo_quantitativo where upper(btrim(codigo)) = p_codigo_novo)
    or exists (select 1 from pcm.sistemas where upper(btrim(codigo)) = p_codigo_novo)
    or exists (select 1 from pcm.equipamentos where upper(btrim(identificador)) = p_codigo_novo)
    or exists (select 1 from pcm.sso_codigo_aliases where upper(btrim(codigo)) = p_codigo_novo)
    or exists (select 1 from pcm.sso_reservas_codigo_parcial where consumida_em is null and liberada_em is null and upper(btrim(codigo)) = p_codigo_novo) then
    raise exception 'codigo_indisponivel' using errcode = '23505';
  end if;
  update pcm.sso_codigos_grupo_quantitativo set atual = false where id = v_atual.id;
  insert into pcm.sso_codigos_grupo_quantitativo(grupo_id, cliente_id, codigo, request_id, ator_id)
    values (p_grupo_id, v_cliente, p_codigo_novo, p_request_id, v_ator) returning id into v_novo;
  v_resultado := jsonb_build_object('ativoId', p_grupo_id, 'tipo', 'grupo_quantitativo', 'codigoAtual', p_codigo_novo,
    'aliasId', v_atual.id, 'codigoId', v_novo, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values (v_ator, 'codigo.substituido', 'grupo_quantitativo', p_grupo_id,
    jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'codigoAnterior', p_codigo_anterior, 'codigoNovo', p_codigo_novo, 'motivo', btrim(p_motivo)));
  insert into pcm.sso_codigo_comandos(request_id, ator_id, cliente_id, payload, resultado) values (p_request_id, v_ator, v_cliente, v_payload, v_resultado);
  return v_resultado;
end $$;
revoke all on function pcm.sso_substituir_codigo_grupo_privado(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
