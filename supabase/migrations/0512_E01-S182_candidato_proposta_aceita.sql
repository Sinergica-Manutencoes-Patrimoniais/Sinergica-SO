-- ADR-0286: candidato pendente, nenhuma cobrança ou lançamento financeiro.
create table financeiro.sso_proposta_faturavel_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into financeiro.sso_proposta_faturavel_gate(id,habilitado) values(true,false);
alter table financeiro.sso_proposta_faturavel_gate enable row level security;
alter table financeiro.sso_proposta_faturavel_gate force row level security;
revoke all on financeiro.sso_proposta_faturavel_gate from public,anon,authenticated,service_role;
create table financeiro.sso_proposta_faturavel_comandos(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null,item_id uuid not null references financeiro.itens_faturaveis(id),criado_em timestamptz not null default now()
);
alter table financeiro.sso_proposta_faturavel_comandos enable row level security;
alter table financeiro.sso_proposta_faturavel_comandos force row level security;
revoke all on financeiro.sso_proposta_faturavel_comandos from public,anon,authenticated,service_role;
create function financeiro.sso_reconhecer_proposta_aceita(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_valor_centavos bigint,p_competencia date)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_proposta comercial.propostas%rowtype; v_cmd financeiro.sso_proposta_faturavel_comandos%rowtype;
  v_preco text; v_item uuid; v_payload jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_proposta_id is null or p_versao is null or p_versao<1
    or p_valor_centavos is null or p_valor_centavos not between 0 and 1000000000000 or p_competencia is null or not isfinite(p_competencia)
    or extract(day from p_competencia)<>1 or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    then raise exception 'dados_invalidos_ou_sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_proposta_faturavel_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'propostaId',p_proposta_id,'versao',p_versao,'valorCentavos',p_valor_centavos,'competencia',p_competencia);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('proposta-faturavel:'||p_request_id::text,0));
  select * into v_proposta from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
  if not found or not exists(select 1 from comercial.proposta_origens_operacionais origem
    join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=origem.ordem_servico_id
    join pcm.ordens_servico o on o.id=origem.ordem_servico_id and o.client_id=p_cliente_id and o.deleted_at is null
    where origem.proposta_id=p_proposta_id) then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  select * into v_cmd from financeiro.sso_proposta_faturavel_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from auth.uid() or v_cmd.cliente_id<>p_cliente_id or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_cmd.item_id;
  end if;
  if v_proposta.status<>'aceita' or v_proposta.versao_atual<>p_versao then raise exception 'proposta_nao_aceita_ou_versao_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from comercial.sso_portal_proposta_comandos c where c.payload->>'propostaId'=p_proposta_id::text
    and c.payload->>'versao'=p_versao::text and c.payload->>'decisao'='aceita' and c.resultado->>'state'='aceita')
    then raise exception 'decisao_versionada_ausente' using errcode='23514'; end if;
  select pub.payload_publico->>'preco_centavos' into v_preco from comercial.sso_orcamento_publicacoes pub where pub.proposta_id=p_proposta_id and pub.versao=p_versao;
  if v_preco is null or v_preco !~ '^(0|[1-9][0-9]{0,12})$' or v_preco::numeric<>p_valor_centavos then raise exception 'valor_nao_comprovado' using errcode='23514'; end if;
  if exists(select 1 from financeiro.fechamentos_mensais where competencia=p_competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
  v_item:=pg_catalog.gen_random_uuid();
  insert into financeiro.itens_faturaveis(id,cliente_id,origem_tipo,origem_id,valor_original_centavos,competencia)
    values(v_item,p_cliente_id,'proposta_operacional',p_proposta_id,p_valor_centavos,p_competencia);
  insert into financeiro.sso_proposta_faturavel_comandos(request_id,ator_id,cliente_id,payload,item_id) values(p_request_id,auth.uid(),p_cliente_id,v_payload,v_item);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.proposta_reconhecida','itens_faturaveis',v_item,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'propostaId',p_proposta_id,'versao',p_versao));
  return v_item;
end $$;
revoke all on function financeiro.sso_reconhecer_proposta_aceita(uuid,uuid,uuid,integer,bigint,date) from public,anon,authenticated,service_role;
