-- ADR-1256: comando separado de correção mediada; gates fechados.
create table pcm.sso_correcao_ingestao_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_correcao_ingestao_gate(id, habilitado) values(true, false);
alter table pcm.sso_correcao_ingestao_gate enable row level security;
alter table pcm.sso_correcao_ingestao_gate force row level security;
revoke all on pcm.sso_correcao_ingestao_gate from public,anon,authenticated,service_role;

create function pcm.sso_corrigir_realizacao_ingestao(p_request_id uuid, p_despesa_id uuid,
  p_expected_revision integer, p_valor_centavos bigint, p_comprovante_objeto_id uuid,
  p_motivo text, p_conferencia_financeira text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_despesa pcm.despesas_visita%rowtype; v_comando pcm.despesa_visita_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb; v_objeto_antigo uuid; v_caminho_antigo text;
  v_objeto_novo uuid; v_caminho_novo text; v_valor_antigo bigint;
begin
  if auth.uid() is null or p_request_id is null or p_despesa_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_valor_centavos is null or p_valor_centavos not between 0 and 9007199254740991
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or p_conferencia_financeira is null or length(btrim(p_conferencia_financeira)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_correcao_ingestao_gate where id and habilitado for share;
  if not found then raise exception 'correcao_ingestao_desabilitada' using errcode = '55000'; end if;
  perform 1 from pcm.sso_ingestao_comprovante_gate where id and habilitado for share;
  if not found then raise exception 'ingestao_desabilitada' using errcode = '55000'; end if;
  perform 1 from pcm.sso_upload_comprovante_gate where id and habilitado for share;
  if not found then raise exception 'ingestao_desabilitada' using errcode = '55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-ingestao-comprovante:' || p_request_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('despesa-visita-request:' || p_request_id::text, 0));
  select * into v_despesa from pcm.despesas_visita where id = p_despesa_id for update;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', v_despesa.cliente_id) is not true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('operacao', 'corrigir_realizacao', 'despesaId', p_despesa_id,
    'expectedRevision', p_expected_revision, 'valorCentavos', p_valor_centavos, 'comprovanteObjetoId', p_comprovante_objeto_id,
    'motivo', btrim(p_motivo), 'conferenciaFinanceira', btrim(p_conferencia_financeira));
  select * into v_comando from pcm.despesa_visita_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  perform 1 from pcm.sso_correcao_despesa_gate where id and habilitado for share;
  if not found then
    raise exception 'correcao_indisponivel' using errcode = '55000'; end if;
  if v_despesa.revisao <> p_expected_revision or v_despesa.status <> 'ativa' then
    raise exception 'revisao_ou_estado_invalido' using errcode = '40001'; end if;
  if v_despesa.realizado_centavos is null then raise exception 'realizacao_nao_comprovada' using errcode = '23514'; end if;
  -- A declaração de repasse conhecida também trava primeiro a despesa.
  -- Recusar contenção dos itens existentes evita esperar sob ordem de locks desconhecida.
  perform f.id from financeiro.itens_faturaveis f where f.cliente_id = v_despesa.cliente_id
    and f.origem_tipo = 'despesa_visita' and f.origem_id = p_despesa_id order by f.id for update nowait;
  if exists (select 1 from financeiro.itens_faturaveis f where f.cliente_id = v_despesa.cliente_id
    and f.origem_tipo = 'despesa_visita' and f.origem_id = p_despesa_id and
    (f.status <> 'cancelado' or financeiro.sso_tem_historico_alocacao(f.id,null,null))) then
    raise exception 'origem_exige_reconciliacao_financeira' using errcode = '23514'; end if;
  select c.objeto_novo, c.caminho_novo into v_objeto_antigo, v_caminho_antigo
    from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id = p_despesa_id order by c.revisao desc limit 1;
  if not found then select r.comprovante_objeto_id, r.comprovante_caminho into v_objeto_antigo, v_caminho_antigo
    from pcm.despesa_visita_realizacoes r where r.despesa_id = p_despesa_id; end if;
  if v_objeto_antigo is null then raise exception 'realizacao_nao_comprovada' using errcode = '23514'; end if;
  v_objeto_novo := coalesce(p_comprovante_objeto_id, v_objeto_antigo);
  if p_comprovante_objeto_id is null then v_caminho_novo := v_caminho_antigo;
  else
    select o.name into v_caminho_novo from pcm.sso_ingestao_comprovante_reservas r
      join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id = r.request_id
      join storage.objects o on o.id = c.objeto_id and o.name = r.caminho and o.bucket_id = 'sso-despesas-visita'
      join storage.buckets b on b.id = o.bucket_id and b.public is false
      where r.request_id = p_request_id and r.ator_id = auth.uid() and r.cliente_id = v_despesa.cliente_id
        and r.despesa_id = p_despesa_id and c.objeto_id = p_comprovante_objeto_id for share of o;
    if not found or exists (select 1 from pcm.despesa_visita_realizacoes r where r.comprovante_objeto_id = p_comprovante_objeto_id)
      or exists (select 1 from pcm.despesa_visita_correcoes_realizacao c where c.objeto_novo = p_comprovante_objeto_id) then
      raise exception 'comprovante_indisponivel' using errcode = '23514'; end if;
  end if;
  if v_despesa.realizado_centavos = p_valor_centavos and v_objeto_antigo = v_objeto_novo then
    raise exception 'nenhuma_alteracao' using errcode = '22023'; end if;
  v_valor_antigo := v_despesa.realizado_centavos;
  update pcm.despesas_visita set realizado_centavos = p_valor_centavos, revisao = revisao + 1
    where id = p_despesa_id returning * into v_despesa;
  insert into pcm.despesa_visita_correcoes_realizacao(despesa_id, revisao, valor_anterior, valor_novo,
    objeto_anterior, caminho_anterior, objeto_novo, caminho_novo, motivo, conferencia_financeira, ator_id, request_id)
    values (p_despesa_id, v_despesa.revisao, v_valor_antigo, p_valor_centavos, v_objeto_antigo, v_caminho_antigo,
      v_objeto_novo, v_caminho_novo, btrim(p_motivo), btrim(p_conferencia_financeira), auth.uid(), p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'despesa_visita.realizacao_corrigida', 'despesas_visita', p_despesa_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_despesa.cliente_id, 'revision', v_despesa.revisao));
  v_resultado := jsonb_build_object('aggregateId', p_despesa_id, 'revision', v_despesa.revisao,
    'state', v_despesa.status, 'requestId', p_request_id, 'linkedIds', jsonb_build_object('visitaId', v_despesa.visita_id));
  insert into pcm.despesa_visita_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, auth.uid(), v_despesa.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;

revoke all on function pcm.sso_corrigir_realizacao_ingestao(uuid,uuid,integer,bigint,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_corrigir_realizacao_ingestao(uuid,uuid,integer,bigint,uuid,text,text) to authenticated;
