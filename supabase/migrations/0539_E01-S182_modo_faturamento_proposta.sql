-- ADR-0313: controle opt-in, sem criação de faturáveis.
create table financeiro.sso_modo_faturamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_modo_faturamento_gate(id,habilitado) values(true,false);
alter table financeiro.sso_modo_faturamento_gate enable row level security;
alter table financeiro.sso_modo_faturamento_gate force row level security;
revoke all on financeiro.sso_modo_faturamento_gate from public,anon,authenticated,service_role;
create table financeiro.sso_modo_faturamento_propostas(
  proposta_id uuid primary key references comercial.propostas(id),cliente_id uuid not null references pcm.clientes(id),
  modo text not null check(modo in ('integral','linhas')),motivo text not null check(length(btrim(motivo)) between 1 and 1000),
  request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table financeiro.sso_modo_faturamento_propostas enable row level security;
alter table financeiro.sso_modo_faturamento_propostas force row level security;
revoke all on financeiro.sso_modo_faturamento_propostas from public,anon,authenticated,service_role;
create function financeiro.sso_modo_faturamento_imutavel() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'modo_faturamento_imutavel' using errcode='23514'; end $$;
revoke all on function financeiro.sso_modo_faturamento_imutavel() from public,anon,authenticated,service_role;
create trigger modo_faturamento_imutavel before update or delete on financeiro.sso_modo_faturamento_propostas for each row execute function financeiro.sso_modo_faturamento_imutavel();
create function financeiro.sso_definir_modo_proposta(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_modo text,p_motivo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v financeiro.sso_modo_faturamento_propostas%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_proposta_id is null or p_modo is null or p_modo not in ('integral','linhas')
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('modo-proposta:'||p_request_id::text,0));
  perform 1 from comercial.propostas p join comercial.proposta_origens_operacionais o on o.proposta_id=p.id
    join pcm.listas_materiais l on l.id=o.lista_materiais_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=o.ordem_servico_id
    join pcm.ordens_servico os on os.id=o.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null
    where p.id=p_proposta_id and p.deleted_at is null and p.status='aceita' for update of p;
  if not found then raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  select * into v from financeiro.sso_modo_faturamento_propostas where request_id=p_request_id;
  if found then
    if v.ator_id is distinct from auth.uid() or v.cliente_id<>p_cliente_id or v.proposta_id<>p_proposta_id or v.modo<>p_modo or v.motivo<>btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v.proposta_id;
  end if;
  if exists(select 1 from financeiro.itens_faturaveis i where i.cliente_id=p_cliente_id and
    ((i.origem_tipo='proposta_operacional' and i.origem_id=p_proposta_id) or
      (i.origem_tipo='material_proposta_linha' and exists(select 1 from financeiro.sso_material_linha_proposta x where x.declaracao_id=i.origem_id and x.proposta_id=p_proposta_id))))
    then raise exception 'origem_ja_faturavel_requer_reconciliacao' using errcode='23514'; end if;
  insert into financeiro.sso_modo_faturamento_propostas(proposta_id,cliente_id,modo,motivo,request_id,ator_id) values(p_proposta_id,p_cliente_id,p_modo,btrim(p_motivo),p_request_id,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.modo_proposta_definido','propostas',p_proposta_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'modo',p_modo));
  return p_proposta_id;
end $$;
revoke all on function financeiro.sso_definir_modo_proposta(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function financeiro.sso_proteger_modo_faturamento_proposta() returns trigger language plpgsql security definer set search_path='' as $$
declare v_proposta uuid; v_cliente uuid; v_modo text; v_preco numeric; v_versao integer;
begin
  if not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) then return new; end if;
  if tg_op='UPDATE' and (old.origem_tipo,old.origem_id,old.cliente_id) is distinct from (new.origem_tipo,new.origem_id,new.cliente_id)
    and (old.origem_tipo in ('proposta_operacional','material_proposta_linha') or new.origem_tipo in ('proposta_operacional','material_proposta_linha')) then
    raise exception 'origem_faturavel_imutavel' using errcode='23514'; end if;
  if new.origem_tipo='proposta_operacional' then v_proposta:=new.origem_id;
  elsif new.origem_tipo='material_proposta_linha' then
    select x.proposta_id,x.versao,x.quantidade::numeric*x.preco_unitario_centavos into v_proposta,v_versao,v_preco
      from financeiro.sso_material_linha_proposta x join financeiro.sso_material_declaracoes d on d.id=x.declaracao_id and d.cliente_id=new.cliente_id
      where x.declaracao_id=new.origem_id and d.estado='aceita';
    if v_proposta is null or new.valor_original_centavos<>v_preco then raise exception 'linha_ou_valor_invalido' using errcode='23514'; end if;
  else return new; end if;
  perform 1 from comercial.propostas p where p.id=v_proposta and p.deleted_at is null for update;
  if not found then raise exception 'proposta_indisponivel' using errcode='23514'; end if;
  select m.cliente_id,m.modo into v_cliente,v_modo from financeiro.sso_modo_faturamento_propostas m where m.proposta_id=v_proposta;
  if v_cliente is distinct from new.cliente_id or v_modo is distinct from (case when new.origem_tipo='proposta_operacional' then 'integral' else 'linhas' end)
    then raise exception 'modo_faturamento_invalido' using errcode='23514'; end if;
  if new.origem_tipo='material_proposta_linha' and not exists(select 1 from comercial.propostas p where p.id=v_proposta and p.versao_atual=v_versao and p.status='aceita') then raise exception 'versao_obsoleta' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function financeiro.sso_proteger_modo_faturamento_proposta() from public,anon,authenticated,service_role;
create trigger sso_itens_modo_proposta before insert or update of origem_tipo,origem_id,cliente_id,valor_original_centavos on financeiro.itens_faturaveis
  for each row execute function financeiro.sso_proteger_modo_faturamento_proposta();
