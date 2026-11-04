-- ADR-1293: consulta sem escrita para tentativa exata.
create function pcm.sso_recibo_vinculo_localizacao(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_lote_id uuid,p_chave text,p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare c pcm.sso_levantamento_comandos%rowtype;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_lote_id is null
    or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>16384 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_vincular_localizacao_gate where id and habilitado for share;
  if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
  perform pcm.sso_exigir_mediacao_conferencia(p_lote_id);
  if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from pcm.sso_levantamento_comandos where request_id=p_request_id and ator_id=p_ator_id and payload=p_payload
    and payload->>'operacao'='vincular_localizacao' and payload->>'loteId'=p_lote_id::text and payload->>'chave'=p_chave;
  if not found or not exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.request_id=p_request_id and i.lote_id=p_lote_id
    and i.linha_chave=p_chave and i.entidade_id::text=c.payload->>'entidadeId') then raise exception 'recibo_indisponivel' using errcode='42501'; end if;
  return c.resultado;
end; $$;
revoke all on function pcm.sso_recibo_vinculo_localizacao(uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_vinculo_localizacao(uuid,uuid,uuid,uuid,text,jsonb) to authenticated;
