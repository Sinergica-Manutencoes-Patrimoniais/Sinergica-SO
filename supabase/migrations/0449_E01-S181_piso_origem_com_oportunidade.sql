-- ADR-0223: guardas aditivas, gate da exceção segue false.
create or replace function comercial.forcar_preco_abaixo_piso_seguro(
  p_proposta_id uuid, p_preco_centavos bigint, p_motivo text default null
) returns comercial.propostas language plpgsql security definer set search_path = '' as $$
begin
  if not config.s184_pode_ver_custos() then raise exception 'sem_permissao_para_forcar_preco' using errcode = '42501'; end if;
  if coalesce((select g.habilitado from comercial.sso_excecao_preco_gate g where g.id), false)
    and exists (select 1 from comercial.proposta_origens_operacionais origem where origem.proposta_id = p_proposta_id) then
    raise exception 'proposta_operacional_exige_fluxo_versionado' using errcode = '23514'; end if;
  return comercial.fn_forcar_preco_abaixo_piso(p_proposta_id, p_preco_centavos, p_motivo);
end;
$$;

create function comercial.sso_escrita_legada_proposta_permitida(p_proposta_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not coalesce((select g.habilitado from comercial.sso_excecao_preco_gate g where g.id), false)
    or not exists (select 1 from comercial.proposta_origens_operacionais origem where origem.proposta_id = p_proposta_id);
$$;
revoke all on function comercial.sso_escrita_legada_proposta_permitida(uuid) from public, anon, service_role;
grant execute on function comercial.sso_escrita_legada_proposta_permitida(uuid) to authenticated;
create policy s181_restringir_escrita_operacional on comercial.propostas as restrictive for update to authenticated
  using (comercial.sso_escrita_legada_proposta_permitida(id))
  with check (comercial.sso_escrita_legada_proposta_permitida(id));
create policy s181_restringir_item_insert on comercial.proposta_itens as restrictive for insert to authenticated
  with check (comercial.sso_escrita_legada_proposta_permitida(proposta_id));
create policy s181_restringir_item_update on comercial.proposta_itens as restrictive for update to authenticated
  using (comercial.sso_escrita_legada_proposta_permitida(proposta_id)) with check (comercial.sso_escrita_legada_proposta_permitida(proposta_id));
create policy s181_restringir_item_delete on comercial.proposta_itens as restrictive for delete to authenticated
  using (comercial.sso_escrita_legada_proposta_permitida(proposta_id));
create policy s181_restringir_versao_insert on comercial.proposta_versoes as restrictive for insert to authenticated
  with check (comercial.sso_escrita_legada_proposta_permitida(proposta_id));
create policy s181_restringir_versao_update on comercial.proposta_versoes as restrictive for update to authenticated
  using (comercial.sso_escrita_legada_proposta_permitida(proposta_id)) with check (comercial.sso_escrita_legada_proposta_permitida(proposta_id));
create policy s181_restringir_versao_delete on comercial.proposta_versoes as restrictive for delete to authenticated
  using (comercial.sso_escrita_legada_proposta_permitida(proposta_id));

create function comercial.sso_orcamento_operacional_autorizado(p_proposta_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_oportunidade uuid;
begin
  select l.cliente_id, p.oportunidade_id into v_cliente, v_oportunidade from comercial.propostas p
    join comercial.proposta_origens_operacionais origem on origem.proposta_id = p.id
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
      and os.client_id = l.cliente_id and os.deleted_at is null where p.id = p_proposta_id and p.deleted_at is null;
  if auth.uid() is null or v_cliente is null or config.sso_autorizar_acao('orcamento.emitir', v_cliente) is not true
    or config.sso_autorizar_acao('custo.ler', v_cliente) is not true
    or (v_oportunidade is not null and not exists (select 1 from comercial.oportunidades o
      where o.id = v_oportunidade and o.cliente_id = v_cliente and o.deleted_at is null)) then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return true;
end;
$$;
revoke all on function comercial.sso_orcamento_operacional_autorizado(uuid) from public, anon, authenticated, service_role;

create or replace function comercial.sso_preco_orcamento_operacional(p_proposta_id uuid)
returns table(versao integer, status text, preco_centavos bigint, valido_ate date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if comercial.sso_orcamento_operacional_autorizado(p_proposta_id) is not true then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select p.versao_atual, p.status, p.preco_centavos, p.valido_ate
    from comercial.propostas p where p.id = p_proposta_id and p.deleted_at is null;
end;
$$;
revoke all on function comercial.sso_preco_orcamento_operacional(uuid) from public, anon, authenticated, service_role;

-- Adaptação de exceção, transição e decisão para oportunidade legítima.
create or replace function comercial.sso_excepcionar_preco_operacional(p_request_id uuid, p_proposta_id uuid,
  p_expected_revision integer, p_preco_centavos bigint, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_proposta comercial.propostas%rowtype; v_cliente uuid; v_os uuid;
  v_anterior comercial.sso_orcamento_operacional_comandos%rowtype; v_payload jsonb; v_resultado jsonb; v_itens jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_proposta_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_preco_centavos is null or p_preco_centavos not between 0 and 1000000000000
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orcamento-operacional:' || p_request_id::text, 0));
  select * into v_proposta from comercial.propostas where id = p_proposta_id and deleted_at is null for update;
  if not found then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select l.cliente_id, os.id into v_cliente, v_os from comercial.proposta_origens_operacionais origem
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
      and os.client_id = l.cliente_id and os.deleted_at is null
    where origem.proposta_id = p_proposta_id for share of l, os;
  if v_cliente is null or config.s184_pode_ver_custos() is not true
    or config.sso_autorizar_acao('orcamento.emitir', v_cliente) is not true
    or config.sso_autorizar_acao('orcamento.excecao_preco', v_cliente) is not true
    or (v_proposta.oportunidade_id is not null and not exists (select 1 from comercial.oportunidades o
      where o.id = v_proposta.oportunidade_id and o.cliente_id = v_cliente and o.deleted_at is null)) then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'excecao_preco', 'propostaId', p_proposta_id,
    'expectedRevision', p_expected_revision, 'precoCentavos', p_preco_centavos, 'motivo', btrim(p_motivo));
  select * into v_anterior from comercial.sso_orcamento_operacional_comandos where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_anterior.resultado;
  end if;
  if not coalesce((select habilitado from comercial.sso_excecao_preco_gate where id), false)
    or (v_proposta.oportunidade_id is null and not coalesce((select habilitado from comercial.sso_origem_operacional_gate where id), false)) then
    raise exception 'excecao_indisponivel' using errcode = '55000'; end if;
  if v_proposta.status <> 'rascunho' or v_proposta.versao_atual <> p_expected_revision then
    raise exception 'revisao_ou_estado_invalido' using errcode = '40001'; end if;
  if p_preco_centavos >= v_proposta.piso_centavos then raise exception 'preco_nao_exige_excecao' using errcode = '22023'; end if;
  if not exists (select 1 from comercial.proposta_itens where proposta_id = p_proposta_id) then
    raise exception 'proposta_incompleta' using errcode = '23514'; end if;
  v_proposta := comercial.fn_forcar_preco_abaixo_piso(p_proposta_id, p_preco_centavos, btrim(p_motivo));
  update comercial.propostas set versao_atual = versao_atual + 1, updated_at = now(), updated_by = auth.uid()
    where id = p_proposta_id returning * into v_proposta;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb) into v_itens
    from comercial.proposta_itens i where i.proposta_id = p_proposta_id;
  insert into comercial.proposta_versoes(proposta_id, versao, payload, criado_por)
    values (p_proposta_id, v_proposta.versao_atual, jsonb_build_object('proposta', to_jsonb(v_proposta), 'itens', v_itens), auth.uid());
  insert into comercial.sso_excecoes_preco_operacional(proposta_id, versao, preco_centavos, piso_centavos, motivo, ator_id, request_id)
    values (p_proposta_id, v_proposta.versao_atual, p_preco_centavos, v_proposta.piso_centavos, btrim(p_motivo), auth.uid(), p_request_id);
  perform pg_catalog.set_config('comercial.forcar_piso', 'false', true);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'orcamento_operacional.excecao_preco', 'propostas', p_proposta_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'osId', v_os, 'versao', v_proposta.versao_atual));
  v_resultado := jsonb_build_object('aggregateId', p_proposta_id, 'revision', v_proposta.versao_atual,
    'state', v_proposta.status, 'requestId', p_request_id);
  insert into comercial.sso_orcamento_operacional_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_excepcionar_preco_operacional(uuid, uuid, integer, bigint, text)
  from public, anon, authenticated, service_role;


create or replace function comercial.sso_transicionar_orcamento_sem_oportunidade(p_request_id uuid, p_proposta_id uuid,
  p_versao integer, p_estado_esperado text, p_acao text, p_escopo_publico text default null,
  p_descricao_publica text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_proposta comercial.propostas%rowtype; v_cliente uuid; v_lista uuid; v_os uuid;
  v_anterior comercial.sso_orcamento_operacional_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
  v_destino text; v_publico jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_proposta_id is null or p_versao is null or p_versao < 1
    or p_estado_esperado is null or p_acao is null or p_acao not in ('revisar', 'aprovar', 'publicar') then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if p_acao = 'publicar' then
    if p_escopo_publico is null or length(btrim(p_escopo_publico)) not between 1 and 4000
      or p_descricao_publica is null or length(btrim(p_descricao_publica)) not between 1 and 1000 then
      raise exception 'descricao_publica_invalida' using errcode = '22023'; end if;
  elsif p_escopo_publico is not null or p_descricao_publica is not null then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orcamento-operacional:' || p_request_id::text, 0));
  select * into v_proposta from comercial.propostas where id = p_proposta_id and deleted_at is null for update;
  if not found then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select l.cliente_id, l.id, os.id into v_cliente, v_lista, v_os from comercial.proposta_origens_operacionais origem
    join pcm.listas_materiais l on l.id = origem.lista_materiais_id
    join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
      and os.client_id = l.cliente_id and os.deleted_at is null
    where origem.proposta_id = p_proposta_id for share of l, os;
  if v_cliente is null or config.sso_autorizar_acao('orcamento.emitir', v_cliente) is not true
    or config.sso_autorizar_acao('custo.ler', v_cliente) is not true
    or (v_proposta.oportunidade_id is not null and not exists (select 1 from comercial.oportunidades o
      where o.id = v_proposta.oportunidade_id and o.cliente_id = v_cliente and o.deleted_at is null)) then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  perform comercial._fn_guarda_comercial_escrita();
  v_payload := jsonb_build_object('operacao', 'transicionar_sem_oportunidade', 'propostaId', p_proposta_id,
    'versao', p_versao, 'estadoEsperado', p_estado_esperado, 'acao', p_acao,
    'escopoPublico', p_escopo_publico, 'descricaoPublica', p_descricao_publica);
  select * into v_anterior from comercial.sso_orcamento_operacional_comandos where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_anterior.resultado;
  end if;
  if v_proposta.oportunidade_id is null and not coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false) then
    raise exception 'origem_operacional_indisponivel' using errcode = '55000'; end if;
  if v_proposta.versao_atual <> p_versao or v_proposta.status <> p_estado_esperado then
    raise exception 'revisao_ou_estado_obsoleto' using errcode = '40001'; end if;
  v_destino := case p_acao when 'revisar' then 'em_revisao' when 'aprovar' then 'aprovada' else 'enviada' end;
  if (p_acao = 'revisar' and p_estado_esperado <> 'rascunho')
    or (p_acao = 'aprovar' and p_estado_esperado <> 'em_revisao')
    or (p_acao = 'publicar' and p_estado_esperado <> 'aprovada') then
    raise exception 'transicao_invalida' using errcode = '23514'; end if;
  if not exists (select 1 from comercial.proposta_versoes v where v.proposta_id = p_proposta_id and v.versao = p_versao)
    or not exists (select 1 from comercial.proposta_itens i where i.proposta_id = p_proposta_id)
    or (v_proposta.preco_centavos < v_proposta.piso_centavos and not exists (
      select 1 from comercial.sso_excecoes_preco_operacional e where e.proposta_id = p_proposta_id
        and e.versao = p_versao and e.preco_centavos = v_proposta.preco_centavos and e.piso_centavos = v_proposta.piso_centavos
        and coalesce((select g.habilitado from comercial.sso_excecao_preco_gate g where g.id), false))) then
    raise exception 'proposta_incompleta_ou_abaixo_piso' using errcode = '23514'; end if;
  if p_acao = 'publicar' then
    if v_proposta.valido_ate is not null and v_proposta.valido_ate < current_date then
      raise exception 'proposta_expirada' using errcode = '23514'; end if;
    v_publico := jsonb_build_object('proposta', jsonb_strip_nulls(jsonb_build_object(
      'tipo', v_proposta.tipo, 'escopo', btrim(p_escopo_publico), 'preco_centavos', v_proposta.preco_centavos,
      'valido_ate', v_proposta.valido_ate, 'versao_atual', p_versao)),
      'itens', jsonb_build_array(jsonb_build_object('descricao', btrim(p_descricao_publica))));
    insert into comercial.sso_orcamento_publicacoes(proposta_id, versao, payload_publico, autor_id)
      values (p_proposta_id, p_versao, v_publico, auth.uid());
  end if;
  if v_proposta.preco_centavos < v_proposta.piso_centavos then
    perform pg_catalog.set_config('comercial.forcar_piso', 'true', true);
  end if;
  update comercial.propostas set status = v_destino, updated_by = auth.uid(), updated_at = now() where id = p_proposta_id;
  perform pg_catalog.set_config('comercial.forcar_piso', 'false', true);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'orcamento_operacional.' || p_acao, 'propostas', p_proposta_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'osId', v_os, 'listaId', v_lista, 'versao', p_versao));
  v_resultado := jsonb_build_object('aggregateId', p_proposta_id, 'revision', p_versao, 'state', v_destino,
    'requestId', p_request_id);
  insert into comercial.sso_orcamento_operacional_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_transicionar_orcamento_sem_oportunidade(uuid, uuid, integer, text, text, text, text)
  from public, anon, authenticated, service_role;

-- Decisão pública mantém validação de exceção vigente e nunca expõe composição.

create or replace function comercial.sso_portal_decidir_proposta_versionada(p_request_id uuid, p_proposta_id uuid,
  p_versao integer, p_decisao text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_proposta comercial.propostas%rowtype; v_cliente uuid; v_payload jsonb; v_resultado jsonb;
  v_comando comercial.sso_portal_proposta_comandos%rowtype; v_status jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_proposta_id is null or p_versao is null or p_versao < 1
    or p_decisao is null or p_decisao not in ('aceita', 'recusada') or length(coalesce(p_motivo, '')) > 2000
    or (p_decisao = 'recusada' and nullif(btrim(p_motivo), '') is null) then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-proposta:' || p_request_id::text, 0));
  select * into v_proposta from comercial.propostas where id = p_proposta_id and deleted_at is null for update;
  if not found then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if v_proposta.oportunidade_id is null then
    if not coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false) then
      raise exception 'origem_operacional_indisponivel' using errcode = '55000'; end if;
    select l.cliente_id into v_cliente from comercial.proposta_origens_operacionais origem
      join pcm.listas_materiais l on l.id = origem.lista_materiais_id
      join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
        and os.client_id = l.cliente_id and os.deleted_at is null
      where origem.proposta_id = p_proposta_id for share of l, os;
  else
    select o.cliente_id into v_cliente from comercial.oportunidades o
      where o.id = v_proposta.oportunidade_id and o.deleted_at is null for share;
  end if;
  if v_cliente is null or auth.jwt()->>'user_role' is distinct from 'cliente-sindico'
    or auth.jwt()->>'cliente_id' is distinct from v_cliente::text or not exists (
      select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
      where uc.user_id = auth.uid() and uc.cliente_id = v_cliente and u.ativo and u.papel = 'cliente-sindico')
    or not exists (select 1 from comercial.proposta_origens_operacionais origem
      join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.client_id = v_cliente and os.deleted_at is null
      where origem.proposta_id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('propostaId', p_proposta_id, 'versao', p_versao,
    'decisao', p_decisao, 'motivo', nullif(btrim(p_motivo), ''));
  select * into v_comando from comercial.sso_portal_proposta_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_proposta.versao_atual <> p_versao then raise exception 'versao_obsoleta' using errcode = '40001'; end if;
  if v_proposta.status <> 'enviada' then raise exception 'decisao_ja_registrada' using errcode = '23505'; end if;
  if v_proposta.valido_ate is not null and v_proposta.valido_ate < current_date then
    raise exception 'proposta_expirada' using errcode = '23514'; end if;
  if not exists (select 1 from comercial.proposta_versoes v where v.proposta_id = p_proposta_id and v.versao = p_versao) then
    raise exception 'versao_nao_encontrada' using errcode = '23514'; end if;
  if v_proposta.oportunidade_id is null then
    insert into comercial.proposta_decisoes(proposta_id, cliente_id, decisao, motivo, autor_user_id)
      values (p_proposta_id, v_cliente, p_decisao, nullif(btrim(p_motivo), ''), auth.uid());
    if v_proposta.preco_centavos < v_proposta.piso_centavos then
      if not coalesce((select habilitado from comercial.sso_excecao_preco_gate where id), false)
        or not exists (select 1 from comercial.sso_excecoes_preco_operacional e where e.proposta_id = p_proposta_id
          and e.versao = p_versao and e.preco_centavos = v_proposta.preco_centavos and e.piso_centavos = v_proposta.piso_centavos) then
        raise exception 'excecao_preco_indisponivel' using errcode = '23514'; end if;
      perform pg_catalog.set_config('comercial.forcar_piso', 'true', true);
    end if;
    update comercial.propostas set status = p_decisao, updated_at = now(), updated_by = auth.uid()
      where id = p_proposta_id;
    perform pg_catalog.set_config('comercial.forcar_piso', 'false', true);
    v_status := jsonb_build_object('status', p_decisao);
  else
    if v_proposta.preco_centavos < v_proposta.piso_centavos then
      if not coalesce((select habilitado from comercial.sso_excecao_preco_gate where id), false)
        or not exists (select 1 from comercial.sso_excecoes_preco_operacional e where e.proposta_id = p_proposta_id
          and e.versao = p_versao and e.preco_centavos = v_proposta.preco_centavos and e.piso_centavos = v_proposta.piso_centavos) then
        raise exception 'excecao_preco_indisponivel' using errcode = '23514'; end if;
      perform pg_catalog.set_config('comercial.forcar_piso', 'true', true);
    end if;
    v_status := comercial.portal_decidir_proposta(p_proposta_id, p_decisao, nullif(btrim(p_motivo), ''));
    perform pg_catalog.set_config('comercial.forcar_piso', 'false', true);
  end if;
  if v_status->>'status' is distinct from p_decisao then raise exception 'decisao_nao_confirmada' using errcode = '23514'; end if;
  v_resultado := jsonb_build_object('aggregateId', p_proposta_id, 'revision', p_versao,
    'state', p_decisao, 'requestId', p_request_id);
  insert into comercial.sso_portal_proposta_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'proposta.decisao_portal_versionada', 'propostas', p_proposta_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'version', p_versao, 'decisao', p_decisao));
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_portal_decidir_proposta_versionada(uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;






