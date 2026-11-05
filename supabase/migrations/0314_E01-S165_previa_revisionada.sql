-- ADR-0092: leitura de conteúdo consistente, não calcula impactos nem habilita aprovação.
create function pcm.sso_projetar_rotina_comparacao(p_dados jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when p_dados is null then null else jsonb_build_object(
    'id', p_dados->'id', 'nome', p_dados->'nome', 'alvo_tipo', p_dados->'alvo_tipo',
    'sistema_id', p_dados->'sistema_id', 'equipamento_id', p_dados->'equipamento_id', 'grupo_id', p_dados->'grupo_id',
    'modo', p_dados->'modo', 'intervalo_n', p_dados->'intervalo_n', 'intervalo_unidade', p_dados->'intervalo_unidade',
    'data_base', p_dados->'data_base', 'tempo_minutos', p_dados->'tempo_minutos', 'tipo_tempo', p_dados->'tipo_tempo',
    'tolerancia_antes', p_dados->'tolerancia_antes', 'tolerancia_depois', p_dados->'tolerancia_depois',
    'instrucao', p_dados->'instrucao', 'questionario_id', p_dados->'questionario_id') end;
$$;
revoke all on function pcm.sso_projetar_rotina_comparacao(jsonb) from public, anon, authenticated, service_role;

create function pcm.sso_previa_revisao_revisionada(
  p_plano_id uuid, p_revisao integer, p_limite integer, p_apos uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_plano pcm.planos_manutencao%rowtype;
  v_rascunho uuid;
  v_origem uuid;
  v_origens integer;
  v_snapshot jsonb;
  v_itens jsonb;
  v_proximo text;
begin
  if p_plano_id is null or p_revisao is null or p_revisao < 1 or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  select * into v_plano from pcm.planos_manutencao where id = p_plano_id;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_plano.cliente_id) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_plano.revisao <> p_revisao then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  select id into v_rascunho from pcm.plano_versoes where plano_id = p_plano_id and estado = 'rascunho';
  if v_rascunho is null then raise exception 'revisao_inexistente' using errcode = '22023'; end if;
  select count(*), min(c.resultado->'linkedIds'->>'versaoOrigemId')::uuid
    into v_origens, v_origem from pcm.plano_comandos c
    join audit.events e on e.entity = 'planos_manutencao' and e.entity_id = p_plano_id
      and e.action = 'plano.revisao_iniciada' and e.actor_id = c.actor_id
      and e.payload->>'requestId' = c.request_id::text
      and e.payload->>'versaoId' = c.resultado->'linkedIds'->>'versaoId'
      and e.payload->>'origem' = c.resultado->'linkedIds'->>'versaoOrigemId'
    where c.payload->>'tipo' = 'iniciarRevisaoPlano' and c.payload->>'planoId' = p_plano_id::text
      and c.resultado->'linkedIds'->>'versaoId' = v_rascunho::text;
  if v_origens <> 1 or v_origem is null then raise exception 'origem_revisao_indisponivel' using errcode = '23514'; end if;
  select snapshot into v_snapshot from pcm.plano_versoes where id = v_origem and plano_id = p_plano_id and estado = 'aprovado';
  if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then
    raise exception 'snapshot_historico_indisponivel' using errcode = '23514';
  end if;
  with anterior as (
    select (j->>'rotina_logica_id')::uuid logica, j dados
    from jsonb_array_elements(v_snapshot->'rotinas') j
  ), nova as (
    select r.rotina_logica_id logica, to_jsonb(r) dados
    from pcm.rotinas_manutencao r
    where r.plano_id = p_plano_id and r.versao_id = v_rascunho
  ), combinada as (
    select coalesce(a.logica, n.logica) logica, a.dados a, n.dados n,
      case when a.logica is null then 'adicionada' when n.logica is null then 'retirada'
        when pcm.sso_campos_rotina_previa(a.dados, null) is distinct from pcm.sso_campos_rotina_previa(n.dados, null) then 'alterada'
        when a.dados->>'questionario_id' is not null then 'questionario_indeterminado'
        else 'inalterada' end classificacao
    from anterior a full join nova n on a.logica = n.logica
    where p_apos is null or coalesce(a.logica, n.logica) > p_apos
    order by coalesce(a.logica, n.logica) limit p_limite + 1
  ), numerada as (
    select *, row_number() over (order by logica) rn from combinada
  )
  select coalesce(jsonb_agg(jsonb_build_object('rotinaLogicaId', logica, 'classificacao', classificacao,
    'questionarioConteudoPendente', coalesce(a->>'questionario_id', n->>'questionario_id') is not null,
    'anterior', pcm.sso_projetar_rotina_comparacao(a),
    'rascunho', pcm.sso_projetar_rotina_comparacao(n)) order by logica)
    filter (where rn <= p_limite), '[]'::jsonb),
    case when count(*) > p_limite then max(logica::text) filter (where rn = p_limite) else null end
  into v_itens, v_proximo from numerada;
  return jsonb_build_object('revision', v_plano.revisao, 'versaoAnteriorId', v_origem,
    'versaoRascunhoId', v_rascunho, 'items', v_itens, 'nextCursor', v_proximo,
    'impactosOperacionaisPendentes', true);
end;
$$;
revoke all on function pcm.sso_previa_revisao_revisionada(uuid, integer, integer, uuid) from public, anon;
grant execute on function pcm.sso_previa_revisao_revisionada(uuid, integer, integer, uuid) to authenticated;
