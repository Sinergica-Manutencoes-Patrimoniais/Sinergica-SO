-- ADR-0923: preservar lógica da 0737 e serializar autorização também no replay.
-- ADR-0512: preservar competências do documento e do item atual.
create or replace function financeiro.sso_liberar_reserva_interna(p_request_id uuid,p_documento_id uuid,p_revisao integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_documentos_internos%rowtype; i financeiro.itens_faturaveis%rowtype; anterior financeiro.sso_documentos_internos_liberacoes%rowtype; payload jsonb;
begin
  if not coalesce((select habilitado from financeiro.sso_reserva_documento_liberacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_documento_id is null or p_revisao is null or p_revisao<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('liberacao-reserva:'||p_request_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faturavel:'||p_request_id::text,0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into d from financeiro.sso_documentos_internos where id=p_documento_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',d.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=d.item_id and cliente_id=d.cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('faturavel.efetivar',d.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  payload:=jsonb_build_object('documentoId',p_documento_id,'revisao',p_revisao,'motivo',btrim(p_motivo));
  select * into anterior from financeiro.sso_documentos_internos_liberacoes where request_id=p_request_id;
  if found then if anterior.ator_id is distinct from auth.uid() or anterior.acao<>'liberar' or anterior.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'documentoInternoId',p_documento_id,'estado','reserva_liberada','cobrancaEnviada',false); end if;
  if i.revisao<>p_revisao then raise exception 'revisao_divergente' using errcode='40001'; end if;
  if exists(select 1 from financeiro.fechamentos_mensais where (competencia=d.competencia or competencia=i.competencia) and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  insert into financeiro.sso_documentos_internos_liberacoes(request_id,documento_interno_id,acao,motivo,payload,ator_id) values(p_request_id,d.id,'liberar',btrim(p_motivo),payload,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.reserva_interna_liberada','itens_faturaveis',i.id,jsonb_build_object('requestId',p_request_id,'clienteId',i.cliente_id,'documentoId',d.id));
  return jsonb_build_object('requestId',p_request_id,'documentoInternoId',d.id,'estado','reserva_liberada','cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_liberar_reserva_interna(uuid,uuid,integer,text) from public,anon,authenticated,service_role;

create or replace function financeiro.sso_converter_reserva_interna(p_request_id uuid,p_documento_id uuid,p_revisao integer,p_alocacao_id uuid,p_lancamento_id uuid,p_documento_ref text,p_data_documento date,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_documentos_internos%rowtype; i financeiro.itens_faturaveis%rowtype; anterior financeiro.sso_documentos_internos_liberacoes%rowtype; payload jsonb; resultado jsonb;
begin
  if not coalesce((select habilitado from financeiro.sso_reserva_documento_liberacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_documento_id is null or p_revisao is null or p_revisao<1 or p_alocacao_id is null or p_lancamento_id is null
    or p_documento_ref is null or length(btrim(p_documento_ref)) not between 1 and 200 or p_data_documento is null or not isfinite(p_data_documento)
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('liberacao-reserva:'||p_request_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('faturavel:'||p_request_id::text,0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into d from financeiro.sso_documentos_internos where id=p_documento_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',d.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from financeiro.lancamentos where id=p_lancamento_id for update;
  select * into i from financeiro.itens_faturaveis where id=d.item_id and cliente_id=d.cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if config.sso_autorizar_acao('faturavel.efetivar',d.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  payload:=jsonb_build_object('documentoId',p_documento_id,'revisao',p_revisao,'alocacaoId',p_alocacao_id,'lancamentoId',p_lancamento_id,'referencia',btrim(p_documento_ref),'data',p_data_documento,'motivo',btrim(p_motivo));
  select * into anterior from financeiro.sso_documentos_internos_liberacoes where request_id=p_request_id;
  if found then if anterior.ator_id is distinct from auth.uid() or anterior.acao<>'converter' or anterior.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  else
    if i.revisao<>p_revisao then raise exception 'revisao_divergente' using errcode='40001'; end if;
    if i.competencia is distinct from d.competencia or i.origem_tipo is distinct from d.origem_tipo or i.origem_id is distinct from d.origem_id then raise exception 'origem_documento_obsoleta' using errcode='40001'; end if;
    if exists(select 1 from financeiro.fechamentos_mensais where (competencia=d.competencia or competencia=i.competencia) and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
    insert into financeiro.sso_documentos_internos_liberacoes(request_id,documento_interno_id,acao,motivo,payload,ator_id) values(p_request_id,d.id,'converter',btrim(p_motivo),payload,auth.uid());
    insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.reserva_interna_convertida','itens_faturaveis',i.id,jsonb_build_object('requestId',p_request_id,'clienteId',i.cliente_id,'documentoId',d.id));
  end if;
  resultado:=financeiro.sso_alocar_faturavel_documento(p_request_id,p_alocacao_id,i.id,p_revisao,p_lancamento_id,p_documento_ref,p_data_documento,d.valor_centavos);
  return jsonb_build_object('requestId',p_request_id,'documentoInternoId',d.id,'alocacao',resultado,'cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_converter_reserva_interna(uuid,uuid,integer,uuid,uuid,text,date,text) from public,anon,authenticated,service_role;
