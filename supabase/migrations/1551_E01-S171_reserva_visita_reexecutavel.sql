-- ADR-1407: repetição da reserva pela identidade estável da Visita.
create or replace function pcm.sso_reservar_criacao_visita(
 p_ator_id uuid,p_visita_id uuid,p_cliente_id uuid,p_contrato_id uuid,p_area_id uuid,p_local_id uuid,
 p_inicio_em timestamptz,p_fim_em timestamptz,p_fuso text,p_natureza text,p_responsavel_id uuid,p_deslocamento_minutos integer
) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_request uuid; v_payload jsonb; v_total bigint; v_existente pcm.sso_reservas_criacao_visita%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_visita_id is null or p_cliente_id is null
   or p_inicio_em is null or p_fim_em is null or not isfinite(p_inicio_em) or not isfinite(p_fim_em) or p_fim_em<=p_inicio_em
   or nullif(btrim(p_fuso),'') is null or p_natureza is null or p_natureza not in ('regular','extra','reposicao_manual')
   or p_deslocamento_minutos is null or p_deslocamento_minutos<0 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_reserva_criacao_visita_gate where id and habilitado for share;
 if not found then raise exception 'reserva_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('tipo','criarVisitaRascunho','expectedRevision',0,'visitaId',p_visita_id,
   'clienteId',p_cliente_id,'contratoId',p_contrato_id,'areaId',p_area_id,'localId',p_local_id,'inicioEm',p_inicio_em,
   'fimEm',p_fim_em,'fuso',p_fuso,'natureza',p_natureza,'responsavelId',p_responsavel_id,'deslocamentoMinutos',p_deslocamento_minutos);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-reserva:'||p_visita_id::text,0));
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*) into v_total from pcm.sso_reservas_criacao_visita r where r.payload->>'visitaId'=p_visita_id::text;
 if v_total>1 then raise exception 'reserva_ambigua' using errcode='23505'; end if;
 if v_total=1 then
   select * into v_existente from pcm.sso_reservas_criacao_visita r where r.payload->>'visitaId'=p_visita_id::text;
   if v_existente.ator_id is distinct from p_ator_id or v_existente.cliente_id is distinct from p_cliente_id or v_existente.payload is distinct from v_payload then
     raise exception 'reserva_indisponivel' using errcode='42501'; end if;
   v_request:=v_existente.request_id;
 else
   v_request:=pg_catalog.gen_random_uuid();
   insert into pcm.sso_reservas_criacao_visita(request_id,ator_id,cliente_id,payload) values(v_request,p_ator_id,p_cliente_id,v_payload);
 end if;
 return jsonb_build_object('requestId',v_request,'visitaId',p_visita_id,'clienteId',p_cliente_id,'criaVisita',false);
end; $$;
