-- ADR-0136. Desativa entrada concorrente; preserva dados e histórico da 0347.
revoke execute on function pcm.sso_receber_matriz_cronograma(uuid,uuid,uuid,text,jsonb) from authenticated;
revoke execute on function pcm.sso_anotar_revisao_cronograma(uuid,uuid,integer,integer,text) from authenticated;
revoke execute on function pcm.sso_listar_cronogramas_staging(uuid,uuid,integer) from authenticated;
revoke execute on function pcm.sso_obter_cronograma_staging(uuid,uuid) from authenticated;

create table pcm.sso_cronograma_staging_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
alter table pcm.sso_cronograma_staging_gate enable row level security;
alter table pcm.sso_cronograma_staging_gate force row level security;
revoke all on pcm.sso_cronograma_staging_gate from public, anon, authenticated, service_role;
insert into pcm.sso_cronograma_staging_gate(id, habilitado) values (true, false);

create function pcm.sso_receber_cronograma_unificado(
  p_request_id uuid, p_lote_id uuid, p_cliente_id uuid, p_fonte_id text, p_matriz jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_comando pcm.sso_levantamento_comandos%rowtype;
  v_lote pcm.sso_levantamentos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_chave text; v_linha jsonb; v_valor jsonb;
  v_criado boolean := false;
begin
  if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id), false) then
    raise exception 'cronograma_staging_bloqueado' using errcode = '55000';
  end if;
  if v_actor is null or p_request_id is null or p_lote_id is null or p_cliente_id is null
    or p_fonte_id is null or p_fonte_id <> btrim(p_fonte_id)
    or length(p_fonte_id) not between 1 and 188
    or p_matriz is null or jsonb_typeof(p_matriz) is distinct from 'array'
    or octet_length(p_matriz::text) > 1048576 then
    raise exception 'matriz_invalida' using errcode = '22023';
  end if;
  if jsonb_array_length(p_matriz) not between 5 and 10000 then
    raise exception 'matriz_invalida' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then
    raise exception 'lote_sem_acesso' using errcode = '42501';
  end if;
  for v_linha in select value from jsonb_array_elements(p_matriz) loop
    if jsonb_typeof(v_linha) is distinct from 'array' then
      raise exception 'linha_invalida' using errcode = '22023';
    end if;
    if jsonb_array_length(v_linha) > 500 then raise exception 'linha_invalida' using errcode = '22023'; end if;
    for v_valor in select value from jsonb_array_elements(v_linha) loop
      if jsonb_typeof(v_valor) not in ('string','number','boolean','null') or octet_length(v_valor::text) > 4000 then
        raise exception 'celula_invalida' using errcode = '22023';
      end if;
    end loop;
  end loop;
  v_chave := 'cronograma:' || p_fonte_id;
  v_payload := jsonb_build_object('tipo','receberCronograma','loteId',p_lote_id,
    'clienteId',p_cliente_id,'fonteId',p_fonte_id,'matriz',p_matriz);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_comando from pcm.sso_levantamento_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_actor or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_comando.resultado;
  end if;
  -- Mesma ordem e chave da recepção S178 impedem duas criações para a mesma origem.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    jsonb_build_array(p_cliente_id, 'planilha', v_chave)::text, 0));
  if config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true then
    raise exception 'lote_sem_acesso' using errcode = '42501';
  end if;
  select * into v_lote from pcm.sso_levantamentos
    where cliente_id = p_cliente_id and origem = 'planilha' and chave_origem = v_chave for update;
  if found then
    if v_lote.id is distinct from p_lote_id or v_lote.conteudo is distinct from p_matriz then
      raise exception 'origem_conflitante' using errcode = '23505';
    end if;
  else
    insert into pcm.sso_levantamentos(id, cliente_id, origem, chave_origem, conteudo, criado_por)
      values(p_lote_id, p_cliente_id, 'planilha', v_chave, p_matriz, v_actor) returning * into v_lote;
    insert into pcm.sso_levantamento_linhas(lote_id, chave, tipo, atributos)
      select p_lote_id, ord::text, 'cronograma', jsonb_build_object('celulas', item)
      from jsonb_array_elements(p_matriz) with ordinality as linhas(item, ord);
    insert into audit.events(actor_id, action, entity, entity_id, payload)
      values(v_actor, 'cronograma.recebido', 'sso_levantamentos', p_lote_id,
        jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revision',1));
    v_criado := true;
  end if;
  v_resultado := jsonb_build_object('aggregateId',v_lote.id,'revision',v_lote.revisao,
    'state','pendente','created',v_criado,'requestId',p_request_id);
  insert into pcm.sso_levantamento_comandos(request_id, ator_id, payload, resultado)
    values(p_request_id, v_actor, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_receber_cronograma_unificado(uuid,uuid,uuid,text,jsonb)
  from public, anon, authenticated, service_role;
