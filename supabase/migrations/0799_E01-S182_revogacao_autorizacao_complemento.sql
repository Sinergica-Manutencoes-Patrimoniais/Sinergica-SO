-- ADR-0574: revogação local e imutável, sem alterar item financeiro.
create table financeiro.sso_revogacao_autorizacao_complemento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_revogacao_autorizacao_complemento_gate(id,habilitado) values(true,false);
alter table financeiro.sso_revogacao_autorizacao_complemento_gate enable row level security;
alter table financeiro.sso_revogacao_autorizacao_complemento_gate force row level security;
revoke all on financeiro.sso_revogacao_autorizacao_complemento_gate from public,anon,authenticated,service_role;
create table financeiro.sso_revogacoes_autorizacao_complemento(request_id uuid primary key,autorizacao_id uuid not null unique references financeiro.sso_autorizacoes_complemento(id),
  revisao_item integer not null,motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table financeiro.sso_revogacoes_autorizacao_complemento enable row level security;
alter table financeiro.sso_revogacoes_autorizacao_complemento force row level security;
revoke all on financeiro.sso_revogacoes_autorizacao_complemento from public,anon,authenticated,service_role;
create trigger sso_revogacao_complemento_imutavel before update or delete on financeiro.sso_revogacoes_autorizacao_complemento for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function financeiro.sso_revogar_autorizacao_complemento(p_request_id uuid,p_cliente_id uuid,p_autorizacao_id uuid,p_expected_revision integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a financeiro.sso_autorizacoes_complemento%rowtype; i financeiro.itens_faturaveis%rowtype; anterior financeiro.sso_revogacoes_autorizacao_complemento%rowtype;
begin
  if not coalesce((select habilitado from financeiro.sso_autorizacao_complemento_gate where id),false) or not coalesce((select habilitado from financeiro.sso_revogacao_autorizacao_complemento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_autorizacao_id is null or p_expected_revision is null or p_expected_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
    or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('revogacao-autorizacao-complemento:'||p_request_id::text,0));
  select * into a from financeiro.sso_autorizacoes_complemento where id=p_autorizacao_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from comercial.propostas where id=a.proposta_id for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into a from financeiro.sso_autorizacoes_complemento where id=p_autorizacao_id and cliente_id=p_cliente_id for update;
  select * into i from financeiro.itens_faturaveis where id=a.item_id and cliente_id=p_cliente_id for update;
  if i.id is null or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_revogacoes_autorizacao_complemento where request_id=p_request_id;
  if found then if anterior.ator_id is distinct from auth.uid() or anterior.autorizacao_id<>a.id or anterior.revisao_item<>p_expected_revision or anterior.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'autorizacaoId',a.id,'estado','revogada','cobrancaAlterada',false); end if;
  if i.revisao<>p_expected_revision or a.revisao_item<>p_expected_revision or i.status<>'pendente' then raise exception 'item_obsoleto_ou_nao_pendente' using errcode='40001'; end if;
  if financeiro.sso_tem_historico_alocacao(i.id,null,null) or exists(select 1 from financeiro.sso_documentos_internos d where d.item_id=i.id and not exists(select 1 from financeiro.sso_documentos_internos_liberacoes l where l.documento_interno_id=d.id)) then raise exception 'item_com_efeito_ou_reserva' using errcode='23514'; end if;
  insert into financeiro.sso_revogacoes_autorizacao_complemento(request_id,autorizacao_id,revisao_item,motivo,ator_id) values(p_request_id,a.id,p_expected_revision,btrim(p_motivo),auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.autorizacao_complemento_revogada','itens_faturaveis',i.id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'autorizacaoId',a.id,'revisaoItem',i.revisao));
  return jsonb_build_object('requestId',p_request_id,'autorizacaoId',a.id,'estado','revogada','cobrancaAlterada',false);
end $$;
revoke all on function financeiro.sso_revogar_autorizacao_complemento(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;

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
  select * into a from financeiro.sso_autorizacoes_complemento where item_id=i.id and cliente_id=i.cliente_id and revisao_item=p_expected_revision;
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
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
