-- ADR-0309: associação preliminar somente, sem criação de faturável.
create table financeiro.sso_material_linha_proposta(
  declaracao_id uuid primary key references financeiro.sso_material_proposta_vinculos(declaracao_id),
  proposta_id uuid not null,versao integer not null,linha_id uuid not null,quantidade integer not null check(quantidade>0),
  preco_unitario_centavos bigint not null check(preco_unitario_centavos>=0),request_id uuid not null unique,ator_id uuid not null references auth.users(id),
  justificativa text not null check(length(btrim(justificativa)) between 1 and 1000),criado_em timestamptz not null default now(),
  foreign key(proposta_id,versao) references comercial.sso_itens_publicos_proposta(proposta_id,versao)
);
alter table financeiro.sso_material_linha_proposta enable row level security;
alter table financeiro.sso_material_linha_proposta force row level security;
revoke all on financeiro.sso_material_linha_proposta from public,anon,authenticated,service_role;
create function financeiro.sso_vincular_material_linha(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_linha_id uuid,p_quantidade integer,p_preco_unitario bigint,p_justificativa text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_material_declaracoes%rowtype; v financeiro.sso_material_proposta_vinculos%rowtype;
  anterior financeiro.sso_material_linha_proposta%rowtype; p comercial.propostas%rowtype; item jsonb; v_soma numeric;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_declaracao_id is null or p_linha_id is null or p_quantidade is null or p_quantidade not between 1 and 999999
    or p_preco_unitario is null or p_preco_unitario not between 0 and 1000000000000 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 1000
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_material_declaracao_gate where id),false)
    or not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vinculo-material-linha:'||p_request_id::text,0));
  select * into d from financeiro.sso_material_declaracoes where id=p_declaracao_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_material_linha_proposta where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.declaracao_id<>p_declaracao_id or anterior.linha_id<>p_linha_id
      or anterior.quantidade<>p_quantidade or anterior.preco_unitario_centavos<>p_preco_unitario or anterior.justificativa<>btrim(p_justificativa)
      then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.declaracao_id;
  end if;
  select * into v from financeiro.sso_material_proposta_vinculos where declaracao_id=d.id and cliente_id=p_cliente_id;
  if not found or d.estado<>'aceita' then raise exception 'vinculo_preliminar_ausente' using errcode='23514'; end if;
  select * into p from comercial.propostas where id=v.proposta_id and deleted_at is null for update;
  if not found or p.status<>'aceita' or p.versao_atual<>v.versao then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  select e into item from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e
    where s.proposta_id=v.proposta_id and s.versao=v.versao and e->>'id'=p_linha_id::text;
  if not found or (item->>'precoUnitarioCentavos')::numeric<>p_preco_unitario then raise exception 'linha_ou_preco_divergente' using errcode='23514'; end if;
  select coalesce(sum(x.quantidade),0) into v_soma from financeiro.sso_material_linha_proposta x
    where x.proposta_id=v.proposta_id and x.versao=v.versao and x.linha_id=p_linha_id;
  if v_soma+p_quantidade>(item->>'quantidade')::numeric then raise exception 'quantidade_excedida' using errcode='23514'; end if;
  insert into financeiro.sso_material_linha_proposta(declaracao_id,proposta_id,versao,linha_id,quantidade,preco_unitario_centavos,request_id,ator_id,justificativa)
    values(d.id,v.proposta_id,v.versao,p_linha_id,p_quantidade,p_preco_unitario,p_request_id,auth.uid(),btrim(p_justificativa));
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'material_fornecido.linha_vinculada','sso_material_declaracoes',d.id,
    jsonb_build_object('requestId',p_request_id,'propostaId',v.proposta_id,'versao',v.versao,'linhaId',p_linha_id,'quantidade',p_quantidade));
  return d.id;
end $$;
revoke all on function financeiro.sso_vincular_material_linha(uuid,uuid,uuid,uuid,integer,bigint,text) from public,anon,authenticated,service_role;
create function financeiro.sso_linhas_material_proposta(p_cliente_id uuid,p_declaracao_id uuid)
returns table(linha_id uuid,descricao text,quantidade integer,preco_unitario_centavos text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from financeiro.sso_material_declaracao_gate where id),false)
    or not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select (e->>'id')::uuid,e->>'descricao',(e->>'quantidade')::integer,e->>'precoUnitarioCentavos'
    from financeiro.sso_material_declaracoes d join financeiro.sso_material_proposta_vinculos v on v.declaracao_id=d.id and v.cliente_id=d.cliente_id
    join comercial.propostas p on p.id=v.proposta_id and p.status='aceita' and p.versao_atual=v.versao and p.deleted_at is null
    join comercial.sso_itens_publicos_proposta s on s.proposta_id=p.id and s.versao=v.versao cross join lateral jsonb_array_elements(s.itens) e
    where d.id=p_declaracao_id and d.cliente_id=p_cliente_id and d.estado='aceita' order by e->>'id';
end $$;
revoke all on function financeiro.sso_linhas_material_proposta(uuid,uuid) from public,anon,authenticated,service_role;
