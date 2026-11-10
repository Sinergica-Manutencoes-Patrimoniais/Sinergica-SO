-- ADR-1681: a aprovação mediada reavalia o recibo integral no servidor.
create function pcm.sso_exigir_recibo_reconciliacao_completo(
 p_ator uuid,p_cliente uuid,p_plano uuid,p_revisao integer,p_vigencia date
) returns void language plpgsql volatile security definer set search_path='' as $$
declare v_cursor text:=null;v_proximo text;v_recibo jsonb;v_bloqueios integer;v_paginas integer:=0;
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_plano is null
   or p_revisao is null or p_revisao<1 or p_vigencia is null or not isfinite(p_vigencia) then
   raise exception 'recibo_reconciliacao_invalido' using errcode='42501'; end if;
 loop
   v_paginas:=v_paginas+1;
   if v_paginas>10000 then raise exception 'recibo_reconciliacao_excede_limite' using errcode='54000'; end if;
   v_recibo:=pcm.sso_recibo_reconciliacao_revisao_mediado(p_ator,p_cliente,p_plano,p_revisao,p_vigencia,v_cursor,50);
   if v_recibo is null or v_recibo->>'revision' is distinct from p_revisao::text
     or jsonb_typeof(v_recibo->'motivosBloqueio') is distinct from 'array' then
     raise exception 'recibo_reconciliacao_incompleto' using errcode='55000'; end if;
   select count(*)::integer into v_bloqueios
   from jsonb_array_elements(v_recibo->'motivosBloqueio') m(valor)
   where m.valor is distinct from '"recibo_paginado_incompleto"'::jsonb;
   if v_bloqueios>0 then raise exception 'recibo_reconciliacao_bloqueado' using errcode='55000'; end if;
   v_proximo:=nullif(v_recibo->>'nextCursor','');
   if v_proximo is null then
     if coalesce((v_recibo->>'confirmacaoBloqueada')::boolean,true) then
       raise exception 'recibo_reconciliacao_bloqueado' using errcode='55000'; end if;
     return;
   end if;
   if v_proximo is not distinct from v_cursor then
     raise exception 'cursor_recibo_sem_progresso' using errcode='55000'; end if;
   v_cursor:=v_proximo;
 end loop;
end; $$;
revoke all on function pcm.sso_exigir_recibo_reconciliacao_completo(uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;

create or replace function pcm.sso_aprovar_revisao_mediada(
 p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_expected_revision integer,p_plano_id uuid,p_vigencia date
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb; v_plano pcm.planos_manutencao%rowtype;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_plano_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_aprovacao_revisao_mediada_gate where id and habilitado for share;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_concorrencia_impacto_gate where id and habilitado for share;
 if not found then raise exception 'protocolo_indisponivel' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03'; end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update nowait;
 if not found then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if v_plano.revisao is distinct from p_expected_revision or v_plano.estado is distinct from 'em_revisao' then
   -- A função legada confere identidade, concessão e payload antes de devolver um replay.
   v_resultado:=pcm.sso_aprovar_revisao_preparada(p_request_id,p_expected_revision,p_plano_id,p_vigencia);
   return v_resultado;
 end if;
 perform pcm.sso_exigir_recibo_reconciliacao_completo(p_ator_id,p_cliente_id,p_plano_id,p_expected_revision,p_vigencia);
 v_resultado:=pcm.sso_aprovar_revisao_preparada(p_request_id,p_expected_revision,p_plano_id,p_vigencia);
 if auth.uid() is distinct from p_ator_id or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_aprovar_revisao_mediada(uuid,uuid,uuid,integer,uuid,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aprovar_revisao_mediada(uuid,uuid,uuid,integer,uuid,date) to authenticated;

create or replace function pcm.sso_aprovar_versao_esperada(p_ator uuid,p_cliente uuid,p_request uuid,p_revisao integer,
  p_plano uuid,p_versao uuid,p_vigencia date,p_revisao_preparada boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_comando pcm.plano_comandos%rowtype;v_payload jsonb;v_resultado jsonb;v_tem_versao_anterior boolean;
begin
 if p_ator is null or p_cliente is null or p_request is null or p_revisao is null or p_revisao<1
   or p_plano is null or p_versao is null or p_vigencia is null or not isfinite(p_vigencia)
   or p_revisao_preparada is null or auth.uid() is distinct from p_ator then raise exception 'pedido_invalido' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_aprovacao_versao_esperada_gate where id and habilitado for share;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'aprovacao_indisponivel' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:'||p_request::text,0)) then raise exception 'pedido_em_andamento' using errcode='55P03'; end if;
 if p_revisao_preparada and not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'revisao_impacto_concorrente_repetir' using errcode='55P03'; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('tipo','aprovarPlano','expectedRevision',p_revisao,'planoId',p_plano,'vigencia',p_vigencia);
 select * into v_comando from pcm.plano_comandos where request_id=p_request;
 if found then
   if v_comando.actor_id is distinct from p_ator or v_comando.cliente_id is distinct from p_cliente or v_comando.payload is distinct from v_payload then raise exception 'pedido_divergente' using errcode='23505'; end if;
   if v_comando.resultado->'linkedIds'->>'versaoId' is distinct from p_versao::text then raise exception 'versao_divergente' using errcode='23505'; end if;
 else
   select exists(select 1 from pcm.plano_versoes where plano_id=p_plano and estado='aprovado') into v_tem_versao_anterior;
   if p_revisao_preparada is distinct from v_tem_versao_anterior then raise exception 'tipo_aprovacao_divergente' using errcode='23514'; end if;
   perform 1 from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id
     where p.id=p_plano and p.cliente_id=p_cliente and p.revisao=p_revisao and p.estado='em_revisao'
       and v.id=p_versao and v.estado='rascunho' for update of v;
   if not found then raise exception 'plano_ou_rascunho_alterado' using errcode='P0011'; end if;
   if pcm.sso_versao_aprovacao_exigida() then
     insert into pcm.sso_aprovacao_versao_tokens(txid,request_id,ator_id,cliente_id,plano_id,versao_id,revisao,vigencia)
       values(pg_catalog.txid_current(),p_request,p_ator,p_cliente,p_plano,p_versao,p_revisao,p_vigencia);
   end if;
 end if;
 if p_revisao_preparada then
   v_resultado:=pcm.sso_aprovar_revisao_mediada(p_ator_id=>p_ator,p_cliente_id=>p_cliente,p_request_id=>p_request,
     p_expected_revision=>p_revisao,p_plano_id=>p_plano,p_vigencia=>p_vigencia);
 else
   v_resultado:=pcm.sso_aprovar_plano(p_request,p_revisao,p_plano,p_vigencia);
 end if;
 if v_resultado->'linkedIds'->>'versaoId' is distinct from p_versao::text then raise exception 'versao_divergente' using errcode='23505'; end if;
 if v_comando.request_id is null and pcm.sso_versao_aprovacao_exigida() then
   delete from pcm.sso_aprovacao_versao_tokens where txid=pg_catalog.txid_current() and request_id=p_request;
 end if;
 return v_resultado;
end; $$;
revoke all on function pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean) to authenticated;
