-- ADR-0226: guardas condicionadas ao gate; não alterar grants públicos.
create or replace function comercial.portal_decidir_proposta(
  p_proposta_id uuid, p_decisao text, p_motivo text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  if not exists (select 1 from config.usuarios u join config.usuario_cliente uc on uc.user_id = u.user_id
    join comercial.oportunidades o on o.cliente_id = uc.cliente_id
    join comercial.propostas p on p.oportunidade_id = o.id
    where u.user_id = auth.uid() and u.ativo and u.papel = 'cliente-sindico'
      and auth.jwt() ->> 'user_role' = 'cliente-sindico'
      and uc.cliente_id::text = auth.jwt() ->> 'cliente_id' and p.id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if coalesce((select g.habilitado from comercial.sso_excecao_preco_gate g where g.id), false)
    and exists (select 1 from comercial.proposta_origens_operacionais origem where origem.proposta_id = p_proposta_id) then
    raise exception 'proposta_operacional_exige_decisao_versionada' using errcode = '23514'; end if;
  select r.status into v_status from comercial.fn_decidir_proposta(p_proposta_id, p_decisao, p_motivo) r;
  return jsonb_build_object('status', v_status);
end;
$$;

-- Duplicação operacional usa fluxo dedicado quando gate está ativo.
create or replace function comercial.fn_duplicar_proposta(p_proposta_id uuid)
returns comercial.propostas
language plpgsql
security invoker
set search_path = comercial, pg_temp
as $$
declare
  v_origem comercial.propostas%rowtype;
  v_nova comercial.propostas%rowtype;
begin
  perform comercial._fn_guarda_comercial_escrita();
  if comercial.sso_escrita_legada_proposta_permitida(p_proposta_id) is not true then
    raise exception 'proposta_operacional_exige_complemento_versionado' using errcode = '23514'; end if;

  select * into v_origem from comercial.propostas where id = p_proposta_id;
  if not found then
    raise exception 'Proposta % não encontrada', p_proposta_id using errcode = 'no_data_found';
  end if;

  insert into comercial.propostas
    (oportunidade_id, tipo, assessment_id, escopo, observacoes,
     custo_total_centavos, piso_centavos, preco_sugerido_centavos, preco_centavos,
     desconto_pct, valido_ate, created_by)
  values
    (v_origem.oportunidade_id, v_origem.tipo, v_origem.assessment_id, v_origem.escopo,
     v_origem.observacoes, v_origem.custo_total_centavos, v_origem.piso_centavos,
     v_origem.preco_sugerido_centavos, v_origem.preco_centavos, v_origem.desconto_pct,
     v_origem.valido_ate, auth.uid())
  returning * into v_nova;

  insert into comercial.proposta_itens
    (proposta_id, tipo, descricao, nivel_id, material_id, quantidade,
     custo_unitario_centavos, total_centavos, created_by)
  select v_nova.id, tipo, descricao, nivel_id, material_id, quantidade,
         custo_unitario_centavos, total_centavos, auth.uid()
    from comercial.proposta_itens
   where proposta_id = p_proposta_id;

  insert into comercial.proposta_versoes (proposta_id, versao, payload, criado_por)
  values (v_nova.id, 1, jsonb_build_object(
    'proposta', to_jsonb(v_nova),
    'duplicadaDe', p_proposta_id
  ), auth.uid());

  return v_nova;
end;
$$;

revoke all on function comercial.fn_duplicar_proposta(uuid) from public;
grant execute on function comercial.fn_duplicar_proposta(uuid) to authenticated;


-- A decisão versionada chama a regra interna após suas próprias guardas.
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
    select jsonb_build_object('status', decisao.status) into v_status
      from comercial.fn_decidir_proposta(p_proposta_id, p_decisao, nullif(btrim(p_motivo), '')) decisao;
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







