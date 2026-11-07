-- ADR-0566: revalidação restritiva, sem modificar a origem.
alter function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) rename to sso_conferencia_base_0791;
revoke all on function financeiro.sso_conferencia_base_0791(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid,p_item_id uuid,p_expected_revision integer,p_acao text,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previa financeiro.itens_faturaveis%rowtype; base financeiro.itens_faturaveis%rowtype; origem pcm.despesas_visita%rowtype; repasse financeiro.sso_declaracoes_repasse_despesa%rowtype;
  vinculo financeiro.sso_material_linha_proposta%rowtype; declaracao financeiro.sso_material_declaracoes%rowtype; proposta comercial.propostas%rowtype; proposta_id uuid; versao integer; preco text; linha jsonb;
begin
  if p_acao is distinct from 'conferir' or not coalesce((select habilitado from financeiro.sso_conferencia_origem_gate where id),false) then return financeiro.sso_conferencia_base_0791(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo); end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into previa from financeiro.itens_faturaveis where id=p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',previa.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if previa.item_base_id is null or exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) then return financeiro.sso_conferencia_base_0791(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo); end if;
  lock table financeiro.fechamentos_mensais in share mode;
  select * into base from financeiro.itens_faturaveis where id=previa.item_base_id and cliente_id=previa.cliente_id;
  if not found or base.item_base_id is not null then raise exception 'base_invalida' using errcode='23514'; end if;
  if base.origem_tipo='despesa_visita' then
    select * into origem from pcm.despesas_visita where id=base.origem_id and cliente_id=base.cliente_id for share;
    select * into repasse from financeiro.sso_declaracoes_repasse_despesa where item_id=base.id and despesa_id=origem.id;
    if origem.id is null or repasse.item_id is null or origem.status<>'ativa' or origem.realizado_centavos is null or origem.revisao<>repasse.despesa_revisao
      or origem.realizado_centavos is distinct from repasse.valor_centavos or base.valor_original_centavos is distinct from repasse.valor_centavos or origem.visita_id is distinct from repasse.visita_id then raise exception 'origem_alterada' using errcode='40001'; end if;
  elsif base.origem_tipo in ('proposta_operacional','material_proposta_linha') then
    if base.origem_tipo='proposta_operacional' then proposta_id:=base.origem_id;
    else
      select * into vinculo from financeiro.sso_material_linha_proposta where declaracao_id=base.origem_id;
      if not found then raise exception 'origem_nao_verificada' using errcode='55000'; end if;
      proposta_id:=vinculo.proposta_id;
    end if;
    select * into proposta from comercial.propostas where id=proposta_id and deleted_at is null for share;
    if not found or proposta.status<>'aceita' then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
    if not exists(select 1 from comercial.proposta_origens_operacionais x join pcm.listas_materiais lm on lm.id=x.lista_materiais_id and lm.cliente_id=base.cliente_id and lm.ordem_servico_id=x.ordem_servico_id
      join pcm.ordens_servico os on os.id=x.ordem_servico_id and os.client_id=base.cliente_id and os.deleted_at is null where x.proposta_id=proposta.id) then raise exception 'origem_nao_verificada' using errcode='23514'; end if;
    if base.origem_tipo='proposta_operacional' then
      if not exists(select 1 from financeiro.sso_proposta_faturavel_comandos c where c.item_id=base.id and c.cliente_id=base.cliente_id and c.payload->>'propostaId'=proposta.id::text
        and c.payload->>'versao'=proposta.versao_atual::text and c.payload->>'valorCentavos'=base.valor_original_centavos::text) then raise exception 'origem_nao_verificada' using errcode='23514'; end if;
      select pub.payload_publico->>'preco_centavos' into preco from comercial.sso_orcamento_publicacoes pub where pub.proposta_id=proposta.id and pub.versao=proposta.versao_atual;
      if preco is null or preco !~ '^(0|[1-9][0-9]{0,12})$' or preco::numeric<>base.valor_original_centavos then raise exception 'valor_divergente' using errcode='23514'; end if;
      versao:=proposta.versao_atual;
    else
      select * into declaracao from financeiro.sso_material_declaracoes where id=base.origem_id and cliente_id=base.cliente_id for share;
      if not found or declaracao.estado<>'aceita' or vinculo.versao<>proposta.versao_atual or vinculo.quantidade::numeric*vinculo.preco_unitario_centavos<>base.valor_original_centavos then raise exception 'linha_obsoleta' using errcode='40001'; end if;
      if not exists(select 1 from financeiro.sso_candidato_linha_comandos c where c.item_id=base.id and c.cliente_id=base.cliente_id and c.payload->>'declaracaoId'=declaracao.id::text and c.payload->>'quantidade'=vinculo.quantidade::text and c.payload->>'precoUnitario'=vinculo.preco_unitario_centavos::text) then raise exception 'origem_nao_verificada' using errcode='23514'; end if;
      select e into linha from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e where s.proposta_id=proposta.id and s.versao=vinculo.versao and e->>'id'=vinculo.linha_id::text;
      if linha is null or linha->>'precoUnitarioCentavos' is distinct from vinculo.preco_unitario_centavos::text then raise exception 'linha_nao_comprovada' using errcode='23514'; end if;
      versao:=vinculo.versao;
    end if;
    if not exists(select 1 from comercial.sso_portal_proposta_comandos c where c.payload->>'propostaId'=proposta.id::text and c.payload->>'versao'=versao::text and c.payload->>'decisao'='aceita' and c.resultado->>'state'='aceita') then raise exception 'decisao_versionada_ausente' using errcode='23514'; end if;
  else raise exception 'origem_nao_verificada' using errcode='55000'; end if;
  perform 1 from financeiro.itens_faturaveis where id=base.id and cliente_id=previa.cliente_id and origem_tipo=base.origem_tipo and origem_id=base.origem_id and valor_original_centavos=base.valor_original_centavos for share;
  if not found then raise exception 'base_alterada' using errcode='40001'; end if;
  return financeiro.sso_conferencia_base_0791(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
end $$;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
