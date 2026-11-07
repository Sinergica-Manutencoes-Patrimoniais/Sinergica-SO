-- ADR-0570: decisão interna registrada; sem aceite de Cliente ou cobrança.
create table financeiro.sso_autorizacao_complemento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_autorizacao_complemento_gate(id,habilitado) values(true,false);
alter table financeiro.sso_autorizacao_complemento_gate enable row level security;
alter table financeiro.sso_autorizacao_complemento_gate force row level security;
revoke all on financeiro.sso_autorizacao_complemento_gate from public,anon,authenticated,service_role;
create table financeiro.sso_autorizacoes_complemento(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),item_id uuid not null references financeiro.itens_faturaveis(id),
  revisao_item integer not null,base_id uuid not null references financeiro.itens_faturaveis(id),proposta_id uuid not null references comercial.propostas(id),versao_proposta integer not null,
  modo text not null check(modo in ('integral','linhas')),valor_centavos bigint not null check(valor_centavos>0),motivo text not null check(length(btrim(motivo)) between 1 and 1000),
  ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(item_id,revisao_item));
alter table financeiro.sso_autorizacoes_complemento enable row level security;
alter table financeiro.sso_autorizacoes_complemento force row level security;
revoke all on financeiro.sso_autorizacoes_complemento from public,anon,authenticated,service_role;
create trigger sso_autorizacao_complemento_imutavel before update or delete on financeiro.sso_autorizacoes_complemento for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function financeiro.sso_autorizar_complemento_interno(p_request_id uuid,p_cliente_id uuid,p_item_id uuid,p_expected_revision integer,p_motivo text)
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
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id for share;
  if base.id is null or i.id is null or i.item_base_id is distinct from base.id or i.origem_id is distinct from base.origem_id or i.origem_tipo is distinct from base.origem_tipo
    or (base.origem_tipo='proposta_operacional' and base.origem_id is distinct from p.id) or (base.origem_tipo='material_proposta_linha' and base.origem_id is distinct from linha.declaracao_id)
    or i.revisao<>p_expected_revision or i.status<>'pendente' or i.valor_original_centavos<=0 or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'item_obsoleto' using errcode='40001'; end if;
  select m.modo into modo from financeiro.sso_consultar_modo_proposta(p_cliente_id,p.id) m;
  if (base.origem_tipo='proposta_operacional' and modo is distinct from 'integral') or (base.origem_tipo='material_proposta_linha' and modo is distinct from 'linhas') then raise exception 'modo_incompativel' using errcode='23514'; end if;
  if not exists(select 1 from comercial.sso_portal_proposta_comandos c where c.payload->>'propostaId'=p.id::text and c.payload->>'versao'=p.versao_atual::text and c.payload->>'decisao'='aceita' and c.resultado->>'state'='aceita') then raise exception 'decisao_versionada_ausente' using errcode='23514'; end if;
  insert into financeiro.sso_autorizacoes_complemento(id,cliente_id,item_id,revisao_item,base_id,proposta_id,versao_proposta,modo,valor_centavos,motivo,ator_id)
    values(p_request_id,p_cliente_id,i.id,i.revisao,base.id,p.id,p.versao_atual,modo,i.valor_original_centavos,btrim(p_motivo),auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.autorizacao_interna_complemento','itens_faturaveis',i.id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revisaoItem',i.revisao,'propostaId',p.id,'versao',p.versao_atual,'modo',modo));
  return jsonb_build_object('requestId',p_request_id,'itemId',i.id,'revisaoItem',i.revisao,'valorCentavos',i.valor_original_centavos::text,'estado','autorizacao_interna','aceiteCliente',false,'cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_autorizar_complemento_interno(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
