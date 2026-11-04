-- ADR-0572: autorização interna, não aceite do Cliente.
create table financeiro.sso_exigir_autorizacao_complemento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_exigir_autorizacao_complemento_gate(id,habilitado) values(true,false);
alter table financeiro.sso_exigir_autorizacao_complemento_gate enable row level security;
alter table financeiro.sso_exigir_autorizacao_complemento_gate force row level security;
revoke all on financeiro.sso_exigir_autorizacao_complemento_gate from public,anon,authenticated,service_role;

create function financeiro.sso_listar_complementos_comercial(p_cliente_id uuid,p_proposta_id uuid,p_apos uuid,p_limite integer)
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
    left join financeiro.sso_autorizacoes_complemento a on a.item_id=i.id and a.revisao_item=i.revisao
    where i.cliente_id=p_cliente_id and (p_apos is null or i.id>p_apos) and
      ((b.origem_tipo='proposta_operacional' and b.origem_id=p_proposta_id) or (b.origem_tipo='material_proposta_linha' and exists(select 1 from financeiro.sso_material_linha_proposta l where l.declaracao_id=b.origem_id and l.proposta_id=p_proposta_id)))
    order by i.id limit p_limite;
end $$;
revoke all on function financeiro.sso_listar_complementos_comercial(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

alter function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) rename to sso_conferencia_base_0797;
revoke all on function financeiro.sso_conferencia_base_0797(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid,p_item_id uuid,p_expected_revision integer,p_acao text,p_valor_centavos bigint,p_motivo text)
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
