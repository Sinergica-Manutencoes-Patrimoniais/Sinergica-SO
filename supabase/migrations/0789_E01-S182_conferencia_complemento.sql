-- ADR-0564: vínculo explícito de complemento; sem efeito externo.
alter function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) rename to sso_conferencia_base_0789;
revoke all on function financeiro.sso_conferencia_base_0789(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid,p_item_id uuid,p_expected_revision integer,p_acao text,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previa financeiro.itens_faturaveis%rowtype; i financeiro.itens_faturaveis%rowtype; base financeiro.itens_faturaveis%rowtype; vinculo financeiro.sso_faturavel_complementos%rowtype; criacao financeiro.sso_faturavel_comandos%rowtype;
begin
  if p_acao is distinct from 'conferir' or not coalesce((select habilitado from financeiro.sso_conferencia_origem_gate where id),false) then return financeiro.sso_conferencia_base_0789(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo); end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into previa from financeiro.itens_faturaveis where id=p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',previa.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if previa.item_base_id is null or exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) then return financeiro.sso_conferencia_base_0789(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo); end if;
  lock table financeiro.fechamentos_mensais in share mode;
  select * into base from financeiro.itens_faturaveis where id=previa.item_base_id and cliente_id=previa.cliente_id for share;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=previa.cliente_id for update;
  if base.id is null or i.id is null or i.item_base_id is distinct from base.id or base.item_base_id is not null or base.status not in ('conferido','parcial','faturado')
    or i.origem_tipo is distinct from base.origem_tipo or i.origem_id is distinct from base.origem_id or i.competencia is distinct from base.competencia
    or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true then raise exception 'base_ou_origem_inconsistente' using errcode='23514'; end if;
  if exists(select 1 from financeiro.fechamentos_mensais where competencia=i.competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  select * into vinculo from financeiro.sso_faturavel_complementos where item_id=i.id and item_base_id=base.id;
  if not found then raise exception 'complemento_sem_vinculo' using errcode='23514'; end if;
  select * into criacao from financeiro.sso_faturavel_comandos where request_id=vinculo.request_id;
  if not found or criacao.payload->>'operacao' is distinct from 'complementar' or criacao.payload->>'itemId' is distinct from i.id::text
    or criacao.payload->>'itemBaseId' is distinct from base.id::text or criacao.payload->>'complementoId' is distinct from i.complemento_id::text
    or criacao.payload->>'valorCentavos' is distinct from i.valor_original_centavos::text then raise exception 'identidade_complemento_inconsistente' using errcode='23514'; end if;
  return financeiro.sso_conferir_ou_cancelar_faturavel_base_0784(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
end $$;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
