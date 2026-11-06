-- ADR-0894: mediação antes do transporte; mantém o gate da 1077 fechado.
create function pcm.sso_reconciliar_cronograma_conferido(
  p_request_id uuid,p_lote_id uuid,p_cliente_id uuid,p_revisao integer,p_motivo text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.cronograma_importacao_lotes%rowtype; v_ativo boolean;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  select habilitado into v_ativo from pcm.sso_reconciliacao_cronograma_gate where id for share;
  if v_ativo is distinct from true then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if p_request_id is null or p_lote_id is null or p_revisao is null or p_revisao < 1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  lock table pcm.cronograma_importacao_lotes,pcm.cronograma_importacao_revisoes,pcm.cronograma_importacao_comandos in share mode nowait;
  select * into v_lote from pcm.cronograma_importacao_lotes where id=p_lote_id and cliente_id=p_cliente_id;
  if not found then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if exists(select 1 from pcm.cronograma_importacao_comandos c where c.payload->>'loteId'=p_lote_id::text and c.payload->>'tipo'='receber'
      and (c.payload is distinct from jsonb_build_object('tipo','receber','loteId',p_lote_id,'clienteId',p_cliente_id,'fonteId',v_lote.fonte_id,'matriz',v_lote.matriz)
        or c.resultado->>'requestId' is distinct from c.request_id::text or c.resultado->>'state' is distinct from 'pendente'
        or jsonb_typeof(c.resultado->'created') is distinct from 'boolean'))
    or not exists(select 1 from pcm.cronograma_importacao_comandos c where c.payload->>'loteId'=p_lote_id::text and c.payload->>'tipo'='receber'
      and c.ator_id=v_lote.criado_por and c.resultado->'created'='true'::jsonb and c.resultado->'revision'='1'::jsonb)
    or exists(select 1 from pcm.cronograma_importacao_revisoes r where r.lote_id=p_lote_id and
      (select count(*) from pcm.cronograma_importacao_comandos c where c.payload->>'loteId'=p_lote_id::text
        and c.ator_id=r.ator_id
        and c.payload=jsonb_build_object('tipo','anotar','loteId',p_lote_id,'expectedRevision',r.revisao-1,'numeroLinha',r.numero_linha,'observacao',r.observacao)
        and c.resultado=jsonb_build_object('aggregateId',p_lote_id,'revision',r.revisao,'state','pendente','created',true,'requestId',c.request_id,'anotacaoId',r.id))<>1)
    or exists(select 1 from pcm.cronograma_importacao_comandos c where c.payload->>'loteId'=p_lote_id::text and c.payload->>'tipo'='anotar'
      and not exists(select 1 from pcm.cronograma_importacao_revisoes r where r.lote_id=p_lote_id and r.ator_id=c.ator_id
        and c.payload=jsonb_build_object('tipo','anotar','loteId',p_lote_id,'expectedRevision',r.revisao-1,'numeroLinha',r.numero_linha,'observacao',r.observacao)
        and c.resultado=jsonb_build_object('aggregateId',p_lote_id,'revision',r.revisao,'state','pendente','created',true,'requestId',c.request_id,'anotacaoId',r.id))) then
    raise exception 'comandos_incompativeis' using errcode='23514';
  end if;
  return pcm.sso_reconciliar_cronograma_legado(p_request_id,p_lote_id,p_cliente_id,p_revisao,p_motivo);
end; $$;
revoke all on function pcm.sso_reconciliar_cronograma_conferido(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reconciliar_cronograma_conferido(uuid,uuid,uuid,integer,text) to authenticated;
revoke execute on function pcm.sso_reconciliar_cronograma_legado(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
