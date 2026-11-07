-- ADR-0048: aprovação local, sem geração operacional.
alter table pcm.plano_versoes add column snapshot jsonb;

create function pcm.sso_aprovar_plano(p_request_id uuid, p_expected_revision integer, p_plano_id uuid, p_vigencia date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_antes pcm.planos_manutencao%rowtype; v_plano pcm.planos_manutencao%rowtype;
  v_versao pcm.plano_versoes%rowtype; v_comando pcm.plano_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_snapshot jsonb; v_erros jsonb := '[]'::jsonb;
  v_avisos jsonb := '[]'::jsonb; v_item record; v_cursor uuid := null; v_lidos integer;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 1 or p_plano_id is null or p_vigencia is null then
    raise exception 'aprovacao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', 'aprovarPlano', 'expectedRevision', p_expected_revision,
    'planoId', p_plano_id, 'vigencia', p_vigencia);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:' || p_request_id::text, 0));
  select * into v_antes from pcm.planos_manutencao where id = p_plano_id for update;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_antes.cliente_id) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_comando from pcm.plano_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_antes.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_antes.estado <> 'em_revisao' then raise exception 'estado_incompativel' using errcode = '22023'; end if;
  select * into v_versao from pcm.plano_versoes where plano_id = p_plano_id and estado = 'rascunho' for update;
  if not found or not exists (select 1 from pcm.rotinas_manutencao where versao_id = v_versao.id) then
    raise exception 'plano_sem_rotinas' using errcode = '23514';
  end if;
  -- Bloqueios em ordem estável impedem alteração das referências até o snapshot.
  perform s.id from pcm.sistemas s where s.id in (select r.sistema_id from pcm.rotinas_manutencao r where r.versao_id = v_versao.id) order by s.id for share;
  perform e.id from pcm.equipamentos e where e.id in (select r.equipamento_id from pcm.rotinas_manutencao r where r.versao_id = v_versao.id) order by e.id for share;
  perform g.id from pcm.grupos_quantitativos g where g.id in (select r.grupo_id from pcm.rotinas_manutencao r where r.versao_id = v_versao.id) order by g.id for share;
  perform q.id from pcm.questionarios q where q.id in (select r.questionario_id from pcm.rotinas_manutencao r where r.versao_id = v_versao.id) order by q.id for share;
  loop
    v_lidos := 0;
    for v_item in select * from pcm.sso_conferir_rotinas_plano(p_plano_id, 100, v_cursor) loop
      v_lidos := v_lidos + 1; v_cursor := v_item.rotina_id;
      if v_item.pendencias && array['recorrencia','data_base','instrucao_ou_questionario','alvo_indisponivel','questionario_indisponivel']::text[] then
        v_erros := v_erros || jsonb_build_array(jsonb_build_object('rotinaId', v_item.rotina_id, 'pendencias', v_item.pendencias));
      end if;
      if v_item.pendencias && array['tempo_a_validar','tipo_tempo']::text[] then
        v_avisos := v_avisos || jsonb_build_array(jsonb_build_object('rotinaId', v_item.rotina_id, 'pendencias', v_item.pendencias));
      end if;
    end loop;
    exit when v_lidos < 100;
  end loop;
  if jsonb_array_length(v_erros) > 0 then
    raise exception 'plano_incompleto' using errcode = '23514', detail = v_erros::text;
  end if;
  select jsonb_build_object('plano', jsonb_build_object('id', v_antes.id, 'cliente_id', v_antes.cliente_id, 'nome', v_antes.nome),
    'rotinas', jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'alvo', jsonb_build_object('id', coalesce(r.sistema_id, r.equipamento_id, r.grupo_id),
        'tipo', r.alvo_tipo, 'nome', case r.alvo_tipo when 'sistema' then s.nome when 'componente' then e.nome else g.nome end),
      'questionario', case when q.id is null then null else to_jsonb(q) end) order by r.id))
  into v_snapshot from pcm.rotinas_manutencao r
  left join pcm.sistemas s on s.id = r.sistema_id and s.cliente_id = v_antes.cliente_id
  left join pcm.equipamentos e on e.id = r.equipamento_id and e.client_id = v_antes.cliente_id
  left join pcm.grupos_quantitativos g on g.id = r.grupo_id and g.cliente_id = v_antes.cliente_id
  left join pcm.questionarios q on q.id = r.questionario_id where r.versao_id = v_versao.id;
  update pcm.plano_versoes set estado = 'aprovado', vigencia_inicio = p_vigencia, aprovada_em = now(), aprovada_por = v_actor, snapshot = v_snapshot where id = v_versao.id;
  update pcm.planos_manutencao set estado = 'aprovado', revisao = revisao + 1, updated_at = now(), updated_by = v_actor where id = p_plano_id returning * into v_plano;
  v_resultado := jsonb_build_object('aggregateId', p_plano_id, 'revision', v_plano.revisao, 'state', v_plano.estado,
    'created', false, 'linkedIds', jsonb_build_object('clienteId', v_plano.cliente_id, 'versaoId', v_versao.id),
    'warnings', v_avisos, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values
    (v_actor, 'plano.aprovado', 'planos_manutencao', p_plano_id, jsonb_build_object('requestId', p_request_id,
      'versaoId', v_versao.id, 'vigencia', p_vigencia, 'antes', to_jsonb(v_antes), 'depois', to_jsonb(v_plano)));
  insert into pcm.plano_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_plano.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_aprovar_plano(uuid, integer, uuid, date) from public, anon;
grant execute on function pcm.sso_aprovar_plano(uuid, integer, uuid, date) to authenticated;
