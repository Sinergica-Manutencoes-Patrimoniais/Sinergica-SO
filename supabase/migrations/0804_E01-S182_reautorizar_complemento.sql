-- ADR-0579: autorizações históricas múltiplas; uma ativa por revisão mediante lock do item.
alter table financeiro.sso_autorizacoes_complemento drop constraint sso_autorizacoes_complemento_item_id_revisao_item_key;
create index sso_autorizacoes_complemento_item_revisao on financeiro.sso_autorizacoes_complemento(item_id,revisao_item,criado_em desc,id desc);
create or replace function financeiro.sso_autorizar_complemento_interno(p_request_id uuid,p_cliente_id uuid,p_item_id uuid,p_expected_revision integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previa financeiro.itens_faturaveis%rowtype; i financeiro.itens_faturaveis%rowtype; base financeiro.itens_faturaveis%rowtype; p comercial.propostas%rowtype;
  linha financeiro.sso_material_linha_proposta%rowtype; a financeiro.sso_autorizacoes_complemento%rowtype; modo text; proposta_id uuid;
begin
  if not coalesce((select habilitado from financeiro.sso_autorizacao_complemento_gate where id),false) or not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_item_id is null or p_expected_revision is null or p_expected_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
    or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('autorizacao-complemento:'||p_request_id::text,0));
  select * into previa from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id;
  if not found or previa.item_base_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into a from financeiro.sso_autorizacoes_complemento where id=p_request_id;
  if found then
    if a.ator_id is distinct from auth.uid() or a.cliente_id<>p_cliente_id or a.item_id<>p_item_id or a.revisao_item<>p_expected_revision or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',a.id,'itemId',a.item_id,'revisaoItem',a.revisao_item,'valorCentavos',a.valor_centavos::text,'estado','autorizacao_interna','aceiteCliente',false,'cobrancaEnviada',false);
  end if;
  select * into base from financeiro.itens_faturaveis where id=previa.item_base_id and cliente_id=p_cliente_id;
  if not found or base.item_base_id is not null then raise exception 'base_invalida' using errcode='23514'; end if;
  if base.origem_tipo='proposta_operacional' then proposta_id:=base.origem_id;
  elsif base.origem_tipo='material_proposta_linha' then select * into linha from financeiro.sso_material_linha_proposta where declaracao_id=base.origem_id; if not found then raise exception 'origem_nao_verificada' using errcode='23514'; end if; proposta_id:=linha.proposta_id;
  else raise exception 'origem_nao_suportada' using errcode='55000'; end if;
  select * into p from comercial.propostas where id=proposta_id and deleted_at is null for share;
  if not found or p.status<>'aceita' or (base.origem_tipo='material_proposta_linha' and linha.versao<>p.versao_atual) then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from comercial.proposta_origens_operacionais x join pcm.listas_materiais lm on lm.id=x.lista_materiais_id and lm.cliente_id=p_cliente_id and lm.ordem_servico_id=x.ordem_servico_id
    join pcm.ordens_servico os on os.id=x.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null where x.proposta_id=p.id) then raise exception 'origem_nao_verificada' using errcode='42501'; end if;
  select * into base from financeiro.itens_faturaveis where id=previa.item_base_id and cliente_id=p_cliente_id for share;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id for update;
  if base.id is null or i.id is null or i.item_base_id is distinct from base.id or i.origem_id is distinct from base.origem_id or i.origem_tipo is distinct from base.origem_tipo
    or (base.origem_tipo='proposta_operacional' and base.origem_id is distinct from p.id) or (base.origem_tipo='material_proposta_linha' and base.origem_id is distinct from linha.declaracao_id)
    or i.revisao<>p_expected_revision or i.status<>'pendente' or i.valor_original_centavos<=0 or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'item_obsoleto' using errcode='40001'; end if;
  select m.modo into modo from financeiro.sso_consultar_modo_proposta(p_cliente_id,p.id) m;
  if (base.origem_tipo='proposta_operacional' and modo is distinct from 'integral') or (base.origem_tipo='material_proposta_linha' and modo is distinct from 'linhas') then raise exception 'modo_incompativel' using errcode='23514'; end if;
  if not exists(select 1 from comercial.sso_portal_proposta_comandos c where c.payload->>'propostaId'=p.id::text and c.payload->>'versao'=p.versao_atual::text and c.payload->>'decisao'='aceita' and c.resultado->>'state'='aceita') then raise exception 'decisao_versionada_ausente' using errcode='23514'; end if;
  if exists(select 1 from financeiro.sso_autorizacoes_complemento x where x.item_id=i.id and x.revisao_item=i.revisao and not exists(select 1 from financeiro.sso_revogacoes_autorizacao_complemento r where r.autorizacao_id=x.id)) then raise exception 'autorizacao_ativa_existente' using errcode='23505'; end if;
  insert into financeiro.sso_autorizacoes_complemento(id,cliente_id,item_id,revisao_item,base_id,proposta_id,versao_proposta,modo,valor_centavos,motivo,ator_id)
    values(p_request_id,p_cliente_id,i.id,i.revisao,base.id,p.id,p.versao_atual,modo,i.valor_original_centavos,btrim(p_motivo),auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.autorizacao_interna_complemento','itens_faturaveis',i.id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revisaoItem',i.revisao,'propostaId',p.id,'versao',p.versao_atual,'modo',modo));
  return jsonb_build_object('requestId',p_request_id,'itemId',i.id,'revisaoItem',i.revisao,'valorCentavos',i.valor_original_centavos::text,'estado','autorizacao_interna','aceiteCliente',false,'cobrancaEnviada',false);
end $$;

create or replace function financeiro.sso_listar_complementos_comercial(p_cliente_id uuid,p_proposta_id uuid,p_apos uuid,p_limite integer)
returns table(item_id uuid,revisao integer,valor_centavos text,estado text,autorizacao_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from financeiro.sso_autorizacao_complemento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_proposta_id is null or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
    or not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.listas_materiais lm on lm.id=o.lista_materiais_id and lm.cliente_id=p_cliente_id and lm.ordem_servico_id=o.ordem_servico_id
      join pcm.ordens_servico os on os.id=o.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null where o.proposta_id=p_proposta_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select i.id,i.revisao,i.valor_original_centavos::text,i.status,a.id from financeiro.itens_faturaveis i
    join financeiro.itens_faturaveis b on b.id=i.item_base_id and b.cliente_id=p_cliente_id
    left join lateral (select x.id from financeiro.sso_autorizacoes_complemento x where x.item_id=i.id and x.revisao_item=i.revisao and not exists(select 1 from financeiro.sso_revogacoes_autorizacao_complemento r where r.autorizacao_id=x.id) order by x.criado_em desc,x.id desc limit 1) a on true
    where i.cliente_id=p_cliente_id and (p_apos is null or i.id>p_apos) and
      ((b.origem_tipo='proposta_operacional' and b.origem_id=p_proposta_id) or (b.origem_tipo='material_proposta_linha' and exists(select 1 from financeiro.sso_material_linha_proposta l where l.declaracao_id=b.origem_id and l.proposta_id=p_proposta_id)))
    order by i.id limit p_limite;
end $$;

create or replace function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid,p_item_id uuid,p_expected_revision integer,p_acao text,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; b financeiro.itens_faturaveis%rowtype; a financeiro.sso_autorizacoes_complemento%rowtype; p comercial.propostas%rowtype; modo text;
begin
  if p_acao is distinct from 'conferir' or not coalesce((select habilitado from financeiro.sso_exigir_autorizacao_complemento_gate where id),false) then return financeiro.sso_conferencia_base_0797(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo); end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into i from financeiro.itens_faturaveis where id=p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if i.item_base_id is null or i.origem_tipo not in ('proposta_operacional','material_proposta_linha') or exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) then return financeiro.sso_conferencia_base_0797(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo); end if;
  if not coalesce((select habilitado from financeiro.sso_conferencia_origem_gate where id),false) or not coalesce((select habilitado from financeiro.sso_autorizacao_complemento_gate where id),false) then raise exception 'autorizacao_indisponivel' using errcode='55000'; end if;
  lock table financeiro.fechamentos_mensais in share mode;
  select x.* into a from financeiro.sso_autorizacoes_complemento x where x.item_id=i.id and x.cliente_id=i.cliente_id and x.revisao_item=p_expected_revision and not exists(select 1 from financeiro.sso_revogacoes_autorizacao_complemento r where r.autorizacao_id=x.id) order by x.criado_em desc,x.id desc limit 1;
  if not found then raise exception 'autorizacao_interna_ausente' using errcode='23514'; end if;
  select * into p from comercial.propostas where id=a.proposta_id and deleted_at is null for share;
  perform 1 from financeiro.sso_autorizacoes_complemento where id=a.id for share;
  if not found or exists(select 1 from financeiro.sso_revogacoes_autorizacao_complemento r where r.autorizacao_id=a.id) then raise exception 'autorizacao_revogada' using errcode='23514'; end if;
  if i.origem_tipo='material_proposta_linha' then
    perform 1 from financeiro.sso_material_declaracoes where id=i.origem_id and cliente_id=i.cliente_id for share;
    if not found then raise exception 'origem_indisponivel' using errcode='40001'; end if;
  end if;
  select * into b from financeiro.itens_faturaveis where id=i.item_base_id and cliente_id=i.cliente_id for share;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=a.cliente_id for update;
  if p.id is null or b.id is null or i.id is null or p.status<>'aceita' or p.versao_atual<>a.versao_proposta or i.item_base_id is distinct from b.id or b.id<>a.base_id
    or i.revisao<>p_expected_revision or i.valor_original_centavos<>a.valor_centavos or p_valor_centavos is distinct from a.valor_centavos then raise exception 'autorizacao_obsoleta_ou_valor_divergente' using errcode='40001'; end if;
  select m.modo into modo from financeiro.sso_consultar_modo_proposta(i.cliente_id,p.id) m;
  if modo is distinct from a.modo then raise exception 'modo_alterado' using errcode='40001'; end if;
  return financeiro.sso_conferencia_base_0797(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
end $$;
