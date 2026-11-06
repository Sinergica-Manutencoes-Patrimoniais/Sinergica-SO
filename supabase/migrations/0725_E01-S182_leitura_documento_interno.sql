-- ADR-0500: leitura de contexto para recuperação, sem mutação financeira.
create function financeiro.sso_contexto_documento_interno(p_cliente_id uuid,p_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; s financeiro.sso_selecoes_documento%rowtype; d financeiro.sso_documentos_internos%rowtype; l financeiro.sso_documentos_internos_liberacoes%rowtype;
begin
  if not coalesce((select habilitado from financeiro.sso_selecao_documento_gate where id),false) or not coalesce((select habilitado from financeiro.sso_documento_interno_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into s from financeiro.sso_selecoes_documento where item_id=i.id and cliente_id=p_cliente_id order by criado_em desc,id desc limit 1;
  select * into d from financeiro.sso_documentos_internos where item_id=i.id and cliente_id=p_cliente_id;
  if d.id is not null then select * into l from financeiro.sso_documentos_internos_liberacoes where documento_interno_id=d.id; end if;
  return jsonb_build_object('itemId',i.id,'revisaoItem',i.revisao,'estadoItem',i.status,'selecao',case when s.id is null then null else
    jsonb_build_object('id',s.id,'revisaoItem',s.revisao_item,'saldoCentavos',s.saldo_centavos::text) end,'documento',case when d.id is null then null else
    jsonb_build_object('id',d.id,'revisaoItem',d.revisao_item,'valorCentavos',d.valor_centavos::text,'estado',case when l.request_id is null then 'reservado' when l.acao='liberar' then 'liberado' else 'convertido' end) end,
    'fiscal',false,'cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_contexto_documento_interno(uuid,uuid) from public,anon,authenticated,service_role;
