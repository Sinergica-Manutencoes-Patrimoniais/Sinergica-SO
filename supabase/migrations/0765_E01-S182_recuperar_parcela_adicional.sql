-- ADR-0540: consulta por pedido, sem execução financeira.
create table financeiro.sso_recuperar_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_recuperar_parcela_gate(id,habilitado) values(true,false);
alter table financeiro.sso_recuperar_parcela_gate enable row level security;
alter table financeiro.sso_recuperar_parcela_gate force row level security;
revoke all on financeiro.sso_recuperar_parcela_gate from public,anon,authenticated,service_role;
create function financeiro.sso_recuperar_parcela_adicional(p_cliente_id uuid,p_item_id uuid,p_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c financeiro.sso_faturavel_comandos%rowtype; a financeiro.sso_faturavel_alocacoes%rowtype;
begin
  if not coalesce((select habilitado from financeiro.sso_recuperar_parcela_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_item_id is null or p_request_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or not exists(select 1 from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into c from financeiro.sso_faturavel_comandos where request_id=p_request_id;
  if not found then return jsonb_build_object('requestId',p_request_id,'itemId',p_item_id,'situacao','nao_encontrado_nao_conclusivo','cobrancaEnviada',false); end if;
  if c.ator_id is distinct from auth.uid() or c.payload->>'operacao'<>'alocar_documento' or c.payload->>'itemId' is distinct from p_item_id::text then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into a from financeiro.sso_faturavel_alocacoes where request_id=p_request_id and item_id=p_item_id;
  if not found then return jsonb_build_object('requestId',p_request_id,'itemId',p_item_id,'situacao','inconsistente_investigar','cobrancaEnviada',false); end if;
  return jsonb_build_object('requestId',p_request_id,'itemId',p_item_id,'situacao','alocacao_registrada','alocacaoId',a.id,'documentoId',a.documento_id,'revisaoItem',a.revisao_item,'cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_recuperar_parcela_adicional(uuid,uuid,uuid) from public,anon,authenticated,service_role;
