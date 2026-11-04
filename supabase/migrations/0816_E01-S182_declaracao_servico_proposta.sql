-- ADR-0591: declaração humana e decisão interna, sem criar faturável.
create table financeiro.sso_servico_extra_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_servico_extra_gate(id,habilitado) values(true,false);
alter table financeiro.sso_servico_extra_gate enable row level security;
alter table financeiro.sso_servico_extra_gate force row level security;
revoke all on financeiro.sso_servico_extra_gate from public,anon,authenticated,service_role;
create table financeiro.sso_servicos_extra_declarados(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),os_id uuid not null references pcm.ordens_servico(id),
  proposta_id uuid not null references comercial.propostas(id),versao integer not null,linha_id uuid not null,quantidade integer not null check(quantidade>0),
  preco_unitario_centavos bigint not null check(preco_unitario_centavos>=0),chave_evento text not null check(length(btrim(chave_evento)) between 1 and 200),
  justificativa text not null check(length(btrim(justificativa)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  unique(cliente_id,chave_evento),foreign key(proposta_id,versao) references comercial.sso_itens_publicos_proposta(proposta_id,versao));
create table financeiro.sso_servicos_extra_decisoes(id uuid primary key,declaracao_id uuid not null unique references financeiro.sso_servicos_extra_declarados(id),
  decisao text not null check(decisao in ('aceita','rejeitada')),motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table financeiro.sso_servicos_extra_declarados enable row level security;
alter table financeiro.sso_servicos_extra_declarados force row level security;
alter table financeiro.sso_servicos_extra_decisoes enable row level security;
alter table financeiro.sso_servicos_extra_decisoes force row level security;
revoke all on financeiro.sso_servicos_extra_declarados,financeiro.sso_servicos_extra_decisoes from public,anon,authenticated,service_role;
create trigger sso_servico_extra_imutavel before update or delete on financeiro.sso_servicos_extra_declarados for each row execute function pcm.sso_proteger_nota_reconciliacao();
create trigger sso_servico_extra_decisao_imutavel before update or delete on financeiro.sso_servicos_extra_decisoes for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function financeiro.sso_declarar_servico_extra(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer,p_linha_id uuid,p_quantidade integer,p_chave_evento text,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare anterior financeiro.sso_servicos_extra_declarados%rowtype; p comercial.propostas%rowtype; item jsonb; modo text;
begin
  if not coalesce((select habilitado from financeiro.sso_servico_extra_gate where id),false) or not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) or not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_proposta_id is null or p_versao is null or p_versao<1 or p_linha_id is null or p_quantidade is null or p_quantidade not between 1 and 999999
    or p_chave_evento is null or length(btrim(p_chave_evento)) not between 1 and 200 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 1000
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('servico-extra:'||p_request_id::text,0));
  select * into anterior from financeiro.sso_servicos_extra_declarados where id=p_request_id;
  if found then if anterior.ator_id is distinct from auth.uid() or anterior.cliente_id<>p_cliente_id or anterior.os_id<>p_os_id or anterior.proposta_id<>p_proposta_id or anterior.versao<>p_versao or anterior.linha_id<>p_linha_id or anterior.quantidade<>p_quantidade or anterior.chave_evento is distinct from btrim(p_chave_evento) or anterior.justificativa is distinct from btrim(p_justificativa) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'estado','declarado_nao_faturavel','cobrancaEnviada',false); end if;
  select * into p from comercial.propostas where id=p_proposta_id and deleted_at is null for share;
  if not found or p.status<>'aceita' or p.versao_atual<>p_versao then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from comercial.proposta_origens_operacionais x join pcm.listas_materiais l on l.id=x.lista_materiais_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id
    join pcm.ordens_servico o on o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null where x.proposta_id=p_proposta_id and x.ordem_servico_id=p_os_id) then raise exception 'origem_nao_verificada' using errcode='42501'; end if;
  select m.modo into modo from financeiro.sso_consultar_modo_proposta(p_cliente_id,p_proposta_id) m;
  if modo is distinct from 'linhas' then raise exception 'modo_incompativel' using errcode='23514'; end if;
  if not exists(select 1 from comercial.sso_portal_proposta_comandos c where c.payload->>'propostaId'=p_proposta_id::text and c.payload->>'versao'=p_versao::text and c.payload->>'decisao'='aceita' and c.resultado->>'state'='aceita') then raise exception 'decisao_ausente' using errcode='23514'; end if;
  select e into item from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e where s.proposta_id=p_proposta_id and s.versao=p_versao and e->>'id'=p_linha_id::text;
  if item is null or item->>'quantidade' !~ '^[1-9][0-9]{0,5}$' or item->>'precoUnitarioCentavos' !~ '^(0|[1-9][0-9]{0,12})$' or p_quantidade>(item->>'quantidade')::integer then raise exception 'linha_invalida' using errcode='23514'; end if;
  insert into financeiro.sso_servicos_extra_declarados(id,cliente_id,os_id,proposta_id,versao,linha_id,quantidade,preco_unitario_centavos,chave_evento,justificativa,ator_id)
    values(p_request_id,p_cliente_id,p_os_id,p_proposta_id,p_versao,p_linha_id,p_quantidade,(item->>'precoUnitarioCentavos')::bigint,btrim(p_chave_evento),btrim(p_justificativa),auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.servico_extra_declarado','ordens_servico',p_os_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'propostaId',p_proposta_id,'versao',p_versao,'linhaId',p_linha_id));
  return jsonb_build_object('requestId',p_request_id,'estado','declarado_nao_faturavel','cobrancaEnviada',false);
end $$;
revoke all on function financeiro.sso_declarar_servico_extra(uuid,uuid,uuid,uuid,integer,uuid,integer,text,text) from public,anon,authenticated,service_role;

create function financeiro.sso_decidir_servico_extra(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_servicos_extra_declarados%rowtype; anterior financeiro.sso_servicos_extra_decisoes%rowtype;
begin
  if not coalesce((select habilitado from financeiro.sso_servico_extra_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_declaracao_id is null or p_decisao is null or p_decisao not in ('aceita','rejeitada') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('servico-extra-decisao:'||p_request_id::text,0));
  select * into d from financeiro.sso_servicos_extra_declarados where id=p_declaracao_id and cliente_id=p_cliente_id for update;
  if not found or d.ator_id=auth.uid() then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_servicos_extra_decisoes where id=p_request_id;
  if found then if anterior.ator_id is distinct from auth.uid() or anterior.declaracao_id<>d.id or anterior.decisao<>p_decisao or anterior.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'estado',anterior.decisao,'geraFaturavel',false); end if;
  insert into financeiro.sso_servicos_extra_decisoes(id,declaracao_id,decisao,motivo,ator_id) values(p_request_id,d.id,p_decisao,btrim(p_motivo),auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.servico_extra_decidido','ordens_servico',d.os_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'declaracaoId',d.id,'decisao',p_decisao));
  return jsonb_build_object('requestId',p_request_id,'estado',p_decisao,'geraFaturavel',false);
end $$;
revoke all on function financeiro.sso_decidir_servico_extra(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
