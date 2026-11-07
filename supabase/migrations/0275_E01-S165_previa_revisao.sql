-- ADR-0051: comparação informativa de conteúdo, sem afirmar impactos operacionais.
create function pcm.sso_campos_rotina_previa(p_rotina jsonb, p_questionario jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_array(p_rotina->'nome', p_rotina->'alvo_tipo', p_rotina->'sistema_id', p_rotina->'equipamento_id',
    p_rotina->'grupo_id', p_rotina->'modo', p_rotina->'intervalo_n', p_rotina->'intervalo_unidade', p_rotina->'data_base',
    p_rotina->'tempo_minutos', p_rotina->'tipo_tempo', p_rotina->'tolerancia_antes', p_rotina->'tolerancia_depois',
    p_rotina->'instrucao', p_rotina->'questionario_id', p_questionario);
$$;
revoke all on function pcm.sso_campos_rotina_previa(jsonb, jsonb) from public, anon, authenticated, service_role;

create function pcm.sso_previa_revisao_plano(p_plano_id uuid, p_limite integer, p_apos uuid)
returns table(rotina_logica_id uuid, rotina_anterior_id uuid, rotina_rascunho_id uuid, nome_anterior text, nome_rascunho text,
  classificacao text, revisao integer, impactos_operacionais_pendentes boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_plano pcm.planos_manutencao%rowtype; v_origem pcm.plano_versoes%rowtype; v_rascunho uuid;
begin
  if p_plano_id is null or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  select * into v_plano from pcm.planos_manutencao where id = p_plano_id;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_plano.cliente_id) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_origem from pcm.plano_versoes where plano_id = p_plano_id and estado = 'aprovado' order by numero desc limit 1;
  if not found or jsonb_typeof(v_origem.snapshot->'rotinas') is distinct from 'array'
    or jsonb_array_length(v_origem.snapshot->'rotinas') = 0 then
    raise exception 'snapshot_historico_indisponivel' using errcode = '23514';
  end if;
  select id into v_rascunho from pcm.plano_versoes where plano_id = p_plano_id and estado = 'rascunho';
  if v_rascunho is null then raise exception 'revisao_inexistente' using errcode = '22023'; end if;
  return query with anterior as (
    select (j->>'rotina_logica_id')::uuid as logica, (j->>'id')::uuid as id, j->>'nome' as nome,
      pcm.sso_campos_rotina_previa(j, j->'questionario') as campos
    from jsonb_array_elements(v_origem.snapshot->'rotinas') j
  ), nova as (
    select r.rotina_logica_id as logica, r.id, r.nome, pcm.sso_campos_rotina_previa(to_jsonb(r), to_jsonb(q)) as campos
    from pcm.rotinas_manutencao r left join pcm.questionarios q on q.id = r.questionario_id
    where r.versao_id = v_rascunho and r.plano_id = p_plano_id
  )
  select coalesce(a.logica, n.logica), a.id, n.id, a.nome, n.nome,
    case when a.id is null then 'adicionada' when n.id is null then 'retirada'
      when a.campos is distinct from n.campos then 'alterada' else 'inalterada' end,
    v_plano.revisao, true
  from anterior a full join nova n on a.logica = n.logica
  where p_apos is null or coalesce(a.logica, n.logica) > p_apos
  order by coalesce(a.logica, n.logica) limit p_limite;
end;
$$;
revoke all on function pcm.sso_previa_revisao_plano(uuid, integer, uuid) from public, anon;
grant execute on function pcm.sso_previa_revisao_plano(uuid, integer, uuid) to authenticated;
