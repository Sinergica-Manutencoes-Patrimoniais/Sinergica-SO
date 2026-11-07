-- ADR-0493: intenção local; não cria documento, lançamento, alocação ou cobrança.
create table financeiro.sso_selecao_documento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_selecao_documento_gate(id,habilitado) values(true,false);
alter table financeiro.sso_selecao_documento_gate enable row level security;
alter table financeiro.sso_selecao_documento_gate force row level security;
revoke all on financeiro.sso_selecao_documento_gate from public,anon,authenticated,service_role;
create table financeiro.sso_selecoes_documento(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),item_id uuid not null references financeiro.itens_faturaveis(id),
  revisao_item integer not null check(revisao_item>0),origem_tipo text not null,origem_id uuid not null,competencia date not null,saldo_centavos bigint not null check(saldo_centavos>0),
  ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(item_id,revisao_item));
alter table financeiro.sso_selecoes_documento enable row level security;
alter table financeiro.sso_selecoes_documento force row level security;
revoke all on financeiro.sso_selecoes_documento from public,anon,authenticated,service_role;
create trigger sso_selecao_documento_imutavel before update or delete on financeiro.sso_selecoes_documento for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function financeiro.sso_selecionar_faturavel_documento(p_request_id uuid,p_item_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i financeiro.itens_faturaveis%rowtype; anterior financeiro.sso_selecoes_documento%rowtype; alocado numeric; saldo bigint;
begin
  if not coalesce((select habilitado from financeiro.sso_selecao_documento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_item_id is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'dados_invalidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('selecao-faturavel:'||p_request_id::text,0));
  lock table financeiro.fechamentos_mensais in share mode;
  select * into i from financeiro.itens_faturaveis where id=p_item_id for update;
  if not found or config.sso_autorizar_acao('faturavel.efetivar',i.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_selecoes_documento where id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.item_id is distinct from p_item_id or anterior.revisao_item<>p_expected_revision then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'itemId',p_item_id,'revisaoItem',anterior.revisao_item,'saldoObservadoCentavos',anterior.saldo_centavos::text,'estado','selecao_local_nao_emitida','reservaSaldo',false);
  end if;
  if i.revisao<>p_expected_revision then raise exception 'revisao_divergente' using errcode='40001'; end if;
  if i.status not in ('conferido','parcial') or i.valor_conferido_centavos is null then raise exception 'item_nao_conferido' using errcode='23514'; end if;
  if exists(select 1 from financeiro.fechamentos_mensais where competencia=i.competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  select coalesce(sum(a.valor_centavos) filter(where e.id is null),0) into alocado from financeiro.sso_faturavel_alocacoes a left join financeiro.sso_faturavel_estornos e on e.alocacao_id=a.id where a.item_id=i.id;
  if alocado<0 or alocado>=i.valor_conferido_centavos then raise exception 'saldo_indisponivel' using errcode='23514'; end if;
  saldo:=(i.valor_conferido_centavos-alocado)::bigint;
  insert into financeiro.sso_selecoes_documento(id,cliente_id,item_id,revisao_item,origem_tipo,origem_id,competencia,saldo_centavos,ator_id)
    values(p_request_id,i.cliente_id,i.id,i.revisao,i.origem_tipo,i.origem_id,i.competencia,saldo,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.selecao_documento_local','itens_faturaveis',i.id,
    jsonb_build_object('requestId',p_request_id,'clienteId',i.cliente_id,'revisaoItem',i.revisao,'competencia',i.competencia));
  return jsonb_build_object('requestId',p_request_id,'itemId',i.id,'revisaoItem',i.revisao,'saldoObservadoCentavos',saldo::text,'estado','selecao_local_nao_emitida','reservaSaldo',false);
end $$;
revoke all on function financeiro.sso_selecionar_faturavel_documento(uuid,uuid,integer) from public,anon,authenticated,service_role;
