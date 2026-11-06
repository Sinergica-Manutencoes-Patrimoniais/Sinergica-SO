-- Repetição idêntica devolve resultado original, mas só com autorização atual.
alter function pcm.sso_salvar_grupo_quantitativo(uuid, integer, uuid, uuid, uuid, uuid, text, bigint, jsonb)
  rename to sso_salvar_grupo_quantitativo_interno;
revoke all on function pcm.sso_salvar_grupo_quantitativo_interno(uuid, integer, uuid, uuid, uuid, uuid, text, bigint, jsonb)
  from public, anon, authenticated;

create function pcm.sso_salvar_grupo_quantitativo(
  p_request_id uuid, p_expected_revision integer, p_grupo_id uuid, p_local_id uuid,
  p_categoria_id uuid, p_sistema_id uuid, p_nome text, p_quantidade bigint, p_caracteristicas jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_comando pcm.estrutura_comandos%rowtype;
  v_payload jsonb;
  v_cliente_id uuid;
begin
  if p_request_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
    select * into v_comando from pcm.estrutura_comandos where request_id = p_request_id;
    if found then
      v_cliente_id := (v_comando.resultado -> 'linkedIds' ->> 'clienteId')::uuid;
      if v_comando.actor_id is distinct from auth.uid()
        or not config.sso_autorizar_acao('cadastro.gerir', v_cliente_id) then
        raise exception 'comando_nao_encontrado_ou_sem_acesso' using errcode = '42501';
      end if;
      v_payload := jsonb_build_object('tipo', 'grupoQuantitativo', 'expectedRevision', p_expected_revision,
        'grupoId', p_grupo_id, 'localId', p_local_id, 'categoriaId', p_categoria_id,
        'sistemaId', p_sistema_id, 'nome', nullif(btrim(p_nome), ''),
        'quantidade', p_quantidade, 'caracteristicas', p_caracteristicas);
      if v_comando.payload is distinct from v_payload then
        raise exception 'request_id_conflitante' using errcode = '23505';
      end if;
      return v_comando.resultado;
    end if;
  end if;
  return pcm.sso_salvar_grupo_quantitativo_interno(p_request_id, p_expected_revision, p_grupo_id,
    p_local_id, p_categoria_id, p_sistema_id, p_nome, p_quantidade, p_caracteristicas);
end;
$$;
revoke all on function pcm.sso_salvar_grupo_quantitativo(uuid, integer, uuid, uuid, uuid, uuid, text, bigint, jsonb) from public, anon;
grant execute on function pcm.sso_salvar_grupo_quantitativo(uuid, integer, uuid, uuid, uuid, uuid, text, bigint, jsonb) to authenticated;
