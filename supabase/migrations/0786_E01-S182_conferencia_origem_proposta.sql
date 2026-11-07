-- ADR-0561: proposta integral/linha, sem inferir origem ou valor.
alter function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) rename to sso_conferencia_base_0786;
revoke all on function financeiro.sso_conferencia_base_0786(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid,p_item_id uuid,p_expected_revision integer,p_acao text,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previa financeiro.itens_faturaveis%rowtype; i financeiro.itens_faturaveis%rowtype; p comercial.propostas%rowtype;
  d financeiro.sso_material_declaracoes%rowtype; vinculo financeiro.sso_material_linha_proposta%rowtype;
  proposta_id uuid; versao integer; preco text; linha jsonb; quantidade numeric; modo text;
begin
  if p_acao is distinct from 'conferir' or not coalesce((select habilitado from financeiro.sso_conferencia_origem_gate where id),false) then
    return financeiro.sso_conferencia_base_0786(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
  end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into previa from financeiro.itens_faturaveis where id=p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',previa.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) then return financeiro.sso_conferencia_base_0786(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo); end if;
  if previa.origem_tipo not in ('proposta_operacional','material_proposta_linha') or previa.item_base_id is not null then
    return financeiro.sso_conferencia_base_0786(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
  end if;
  if not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) then raise exception 'origem_indisponivel' using errcode='55000'; end if;
  if previa.origem_tipo='proposta_operacional' then
    if not coalesce((select habilitado from financeiro.sso_proposta_faturavel_gate where id),false) then raise exception 'origem_indisponivel' using errcode='55000'; end if;
    proposta_id:=previa.origem_id;
  else
    if not coalesce((select habilitado from financeiro.sso_candidato_linha_gate where id),false) or not coalesce((select habilitado from financeiro.sso_material_declaracao_gate where id),false)
      or not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'origem_indisponivel' using errcode='55000'; end if;
    select * into vinculo from financeiro.sso_material_linha_proposta where declaracao_id=previa.origem_id;
    if not found then raise exception 'origem_nao_verificada' using errcode='55000'; end if;
    proposta_id:=vinculo.proposta_id;
  end if;
  select * into p from comercial.propostas where id=proposta_id and deleted_at is null for share;
  if not found or p.status<>'aceita' then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  if previa.origem_tipo='material_proposta_linha' then select * into d from financeiro.sso_material_declaracoes where id=previa.origem_id and cliente_id=previa.cliente_id for share; end if;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=previa.cliente_id for update;
  if not found or i.origem_tipo is distinct from previa.origem_tipo or i.origem_id is distinct from previa.origem_id or i.item_base_id is not null
    or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true then raise exception 'origem_alterada' using errcode='40001'; end if;
  if not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.listas_materiais lm on lm.id=o.lista_materiais_id and lm.cliente_id=i.cliente_id and lm.ordem_servico_id=o.ordem_servico_id
    join pcm.ordens_servico os on os.id=o.ordem_servico_id and os.client_id=i.cliente_id and os.deleted_at is null where o.proposta_id=p.id) then raise exception 'origem_nao_verificada' using errcode='23514'; end if;
  select m.modo into modo from financeiro.sso_consultar_modo_proposta(i.cliente_id,p.id) m;
  if previa.origem_tipo='proposta_operacional' then
    if modo is distinct from 'integral' then raise exception 'modo_incompativel' using errcode='23514'; end if;
    if not exists(select 1 from financeiro.sso_proposta_faturavel_comandos c where c.item_id=i.id and c.cliente_id=i.cliente_id and c.payload->>'propostaId'=p.id::text
      and c.payload->>'versao'=p.versao_atual::text and c.payload->>'valorCentavos'=i.valor_original_centavos::text) then raise exception 'origem_nao_verificada' using errcode='23514'; end if;
    select pub.payload_publico->>'preco_centavos' into preco from comercial.sso_orcamento_publicacoes pub where pub.proposta_id=p.id and pub.versao=p.versao_atual;
    if preco is null or preco !~ '^(0|[1-9][0-9]{0,12})$' or preco::numeric<>i.valor_original_centavos then raise exception 'valor_divergente' using errcode='23514'; end if;
    versao:=p.versao_atual;
  else
    if modo is distinct from 'linhas' or d.id is null or d.estado<>'aceita' or vinculo.versao<>p.versao_atual then raise exception 'linha_obsoleta' using errcode='40001'; end if;
    if not exists(select 1 from financeiro.sso_candidato_linha_comandos c where c.item_id=i.id and c.cliente_id=i.cliente_id and c.payload->>'declaracaoId'=d.id::text
      and c.payload->>'quantidade'=vinculo.quantidade::text and c.payload->>'precoUnitario'=vinculo.preco_unitario_centavos::text) then raise exception 'origem_nao_verificada' using errcode='23514'; end if;
    if vinculo.quantidade::numeric*vinculo.preco_unitario_centavos<>i.valor_original_centavos then raise exception 'valor_divergente' using errcode='23514'; end if;
    select e into linha from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e where s.proposta_id=p.id and s.versao=vinculo.versao and e->>'id'=vinculo.linha_id::text;
    if linha is null or linha->>'precoUnitarioCentavos' is distinct from vinculo.preco_unitario_centavos::text then raise exception 'linha_nao_comprovada' using errcode='23514'; end if;
    select coalesce(sum(x.quantidade),0) into quantidade from financeiro.sso_material_linha_proposta x where x.proposta_id=p.id and x.versao=vinculo.versao and x.linha_id=vinculo.linha_id;
    if linha->>'quantidade' is null or linha->>'quantidade' !~ '^[0-9]{1,12}$' or quantidade>(linha->>'quantidade')::numeric then raise exception 'quantidade_invalida' using errcode='23514'; end if;
    versao:=vinculo.versao;
  end if;
  if not exists(select 1 from comercial.sso_portal_proposta_comandos c where c.payload->>'propostaId'=p.id::text and c.payload->>'versao'=versao::text and c.payload->>'decisao'='aceita' and c.resultado->>'state'='aceita') then raise exception 'decisao_versionada_ausente' using errcode='23514'; end if;
  return financeiro.sso_conferir_ou_cancelar_faturavel_base_0784(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
end $$;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
