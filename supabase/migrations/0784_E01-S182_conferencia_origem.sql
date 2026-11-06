-- ADR-0559: verificação limitada à origem despesa, fail-closed para demais origens.
create table financeiro.sso_conferencia_origem_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_conferencia_origem_gate(id,habilitado) values(true,false);
alter table financeiro.sso_conferencia_origem_gate enable row level security;
alter table financeiro.sso_conferencia_origem_gate force row level security;
revoke all on financeiro.sso_conferencia_origem_gate from public,anon,authenticated,service_role;
alter function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) rename to sso_conferir_ou_cancelar_faturavel_base_0784;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel_base_0784(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id uuid,p_item_id uuid,p_expected_revision integer,p_acao text,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previa financeiro.itens_faturaveis%rowtype; i financeiro.itens_faturaveis%rowtype; d pcm.despesas_visita%rowtype; r financeiro.sso_declaracoes_repasse_despesa%rowtype;
begin
  if p_acao is distinct from 'conferir' or not coalesce((select habilitado from financeiro.sso_conferencia_origem_gate where id),false) then
    return financeiro.sso_conferir_ou_cancelar_faturavel_base_0784(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
  end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into previa from financeiro.itens_faturaveis where id=p_item_id;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',previa.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) then
    return financeiro.sso_conferir_ou_cancelar_faturavel_base_0784(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
  end if;
  if previa.origem_tipo<>'despesa_visita' or previa.item_base_id is not null then raise exception 'origem_nao_verificada' using errcode='55000'; end if;
  select * into d from pcm.despesas_visita where id=previa.origem_id and cliente_id=previa.cliente_id for share;
  select * into i from financeiro.itens_faturaveis where id=p_item_id and cliente_id=previa.cliente_id for update;
  if d.id is null or i.id is null or i.origem_tipo is distinct from previa.origem_tipo or i.origem_id is distinct from previa.origem_id or i.item_base_id is not null
    or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true then raise exception 'origem_invalida' using errcode='40001'; end if;
  select * into r from financeiro.sso_declaracoes_repasse_despesa where item_id=i.id and despesa_id=d.id;
  if not found or d.status<>'ativa' or d.realizado_centavos is null or d.revisao<>r.despesa_revisao or d.realizado_centavos is distinct from r.valor_centavos
    or i.valor_original_centavos is distinct from r.valor_centavos or r.visita_id is distinct from d.visita_id then raise exception 'origem_alterada' using errcode='40001'; end if;
  return financeiro.sso_conferir_ou_cancelar_faturavel_base_0784(p_request_id,p_item_id,p_expected_revision,p_acao,p_valor_centavos,p_motivo);
end $$;
revoke all on function financeiro.sso_conferir_ou_cancelar_faturavel(uuid,uuid,integer,text,bigint,text) from public,anon,authenticated,service_role;
