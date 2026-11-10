-- ADR-0078: projeção mínima de questionário, sem expor payload remoto bruto.
create or replace function pcm.sso_questionario_rotina_aprovada(p_plano_id uuid, p_versao_id uuid, p_rotina_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_versao pcm.plano_versoes%rowtype; v_rotina jsonb; v_q jsonb; v_total integer;
begin
  if p_plano_id is null or p_versao_id is null or p_rotina_id is null then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  select p.cliente_id into v_cliente from pcm.planos_manutencao p where p.id = p_plano_id;
  if v_cliente is null or not config.sso_autorizar_acao('plano.gerir', v_cliente) then
    raise exception 'plano_ou_versao_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_versao from pcm.plano_versoes where id = p_versao_id and plano_id = p_plano_id;
  if not found then raise exception 'plano_ou_versao_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if v_versao.estado <> 'aprovado' or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then
    raise exception 'snapshot_historico_indisponivel' using errcode = '23514';
  end if;
  select count(*), min(r.item::text)::jsonb into v_total, v_rotina
    from jsonb_array_elements(v_versao.snapshot->'rotinas') r(item) where r.item->>'id' = p_rotina_id::text;
  if v_total <> 1 then raise exception 'rotina_historica_indisponivel' using errcode = '23514'; end if;
  v_q := v_rotina->'questionario';
  if v_q is null or v_q = 'null'::jsonb then
    if v_rotina->>'questionario_id' is not null then raise exception 'questionario_historico_invalido' using errcode = '23514'; end if;
    return jsonb_build_object('rotinaId', p_rotina_id, 'versaoId', p_versao_id, 'questionario', null);
  end if;
  if jsonb_typeof(v_q) <> 'object' or v_q->>'id' is null or v_q->>'id' is distinct from v_rotina->>'questionario_id'
    or v_q->>'nome' is null or jsonb_typeof(v_q->'perguntas') is distinct from 'array' then
    raise exception 'questionario_historico_invalido' using errcode = '23514';
  end if;
  return jsonb_build_object('rotinaId', p_rotina_id, 'versaoId', p_versao_id,
    'questionario', jsonb_build_object('id', v_q->>'id', 'nome', v_q->>'nome',
      'cabecalho', v_q->'cabecalho', 'rodape', v_q->'rodape', 'perguntas', v_q->'perguntas'));
end;
$$;
revoke all on function pcm.sso_questionario_rotina_aprovada(uuid, uuid, uuid) from public, anon;
grant execute on function pcm.sso_questionario_rotina_aprovada(uuid, uuid, uuid) to authenticated;
