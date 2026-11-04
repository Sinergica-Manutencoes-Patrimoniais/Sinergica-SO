-- ADR-0557: guarda fechada pelo gate financeiro, sem modificar comportamento legado desligado.
alter function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) rename to sso_conferir_ou_cancelar_faturavel_base_0782;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel_base_0782(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid,p_item_id uuid,p_expected_revision integer,p_acao text,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype;
begin
  if p_acao is distinct from 'cancelar' or not coalesce((select habilitado from financeiro.sso_faturamento_gate where id),false) then
    return financeiro.sso_conferir_ou_cancelar_faturavel_base_0782(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
  end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into i from financeiro.itens_faturaveis where id=p_item_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) then
    return financeiro.sso_conferir_ou_cancelar_faturavel_base_0782(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
  end if;
  if exists(select 1 from financeiro.fechamentos_mensais where competencia=i.competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  if financeiro.sso_tem_historico_alocacao(i.id,null,null) or exists(select 1 from financeiro.sso_documentos_internos d where d.item_id=i.id
    and not exists(select 1 from financeiro.sso_documentos_internos_liberacoes l where l.documento_interno_id=d.id)) then raise exception 'historico_ou_reserva_exige_conferencia' using errcode='23514'; end if;
  return financeiro.sso_conferir_ou_cancelar_faturavel_base_0782(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
end $$;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
