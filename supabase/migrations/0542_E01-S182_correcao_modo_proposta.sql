-- ADR-0316: histórico append-only; correção não reinterpreta alocações.
create table financeiro.sso_modo_faturamento_correcoes(
  proposta_id uuid not null references financeiro.sso_modo_faturamento_propostas(proposta_id),revisao integer not null check(revisao>1),
  modo_anterior text not null check(modo_anterior in ('integral','linhas')),modo_novo text not null check(modo_novo in ('integral','linhas')),
  motivo text not null check(length(btrim(motivo)) between 1 and 1000),request_id uuid not null unique,ator_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),primary key(proposta_id,revisao),check(modo_anterior<>modo_novo)
);
alter table financeiro.sso_modo_faturamento_correcoes enable row level security;
alter table financeiro.sso_modo_faturamento_correcoes force row level security;
revoke all on financeiro.sso_modo_faturamento_correcoes from public,anon,authenticated,service_role;
create trigger modo_faturamento_correcao_imutavel before update or delete on financeiro.sso_modo_faturamento_correcoes for each row execute function financeiro.sso_modo_faturamento_imutavel();
create function financeiro.sso_corrigir_modo_proposta(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_revisao integer,p_modo text,p_motivo text)
returns integer language plpgsql security definer set search_path='' as $$
declare base financeiro.sso_modo_faturamento_propostas%rowtype; anterior financeiro.sso_modo_faturamento_correcoes%rowtype; v_revisao integer; v_modo text;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_proposta_id is null or p_revisao is null or p_revisao<1
    or p_modo is null or p_modo not in ('integral','linhas') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
    or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  if not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('correcao-modo:'||p_request_id::text,0));
  perform 1 from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into base from financeiro.sso_modo_faturamento_propostas where proposta_id=p_proposta_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_modo_faturamento_correcoes where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.proposta_id<>p_proposta_id or anterior.revisao<>p_revisao+1 or anterior.modo_novo<>p_modo or anterior.motivo<>btrim(p_motivo)
      then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.revisao;
  end if;
  select c.revisao,c.modo_novo into v_revisao,v_modo from financeiro.sso_modo_faturamento_correcoes c where c.proposta_id=p_proposta_id order by c.revisao desc limit 1;
  if not found then v_revisao:=1; v_modo:=base.modo; end if;
  if v_revisao<>p_revisao or v_modo=p_modo then raise exception 'revisao_ou_modo_invalido' using errcode='40001'; end if;
  if exists(select 1 from financeiro.itens_faturaveis i where i.cliente_id=p_cliente_id
    and ((i.origem_tipo='proposta_operacional' and i.origem_id=p_proposta_id) or (i.origem_tipo='material_proposta_linha'
      and exists(select 1 from financeiro.sso_material_linha_proposta x where x.declaracao_id=i.origem_id and x.proposta_id=p_proposta_id)))
    and (i.status<>'cancelado' or exists(select 1 from financeiro.sso_faturavel_alocacoes a where a.item_id=i.id)))
    then raise exception 'faturavel_ou_alocacao_existente' using errcode='23514'; end if;
  insert into financeiro.sso_modo_faturamento_correcoes(proposta_id,revisao,modo_anterior,modo_novo,motivo,request_id,ator_id)
    values(p_proposta_id,v_revisao+1,v_modo,p_modo,btrim(p_motivo),p_request_id,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.modo_proposta_corrigido','propostas',p_proposta_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revisao',v_revisao+1,'modoAnterior',v_modo,'modoNovo',p_modo));
  return v_revisao+1;
end $$;
revoke all on function financeiro.sso_corrigir_modo_proposta(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function financeiro.sso_consultar_modo_proposta(p_cliente_id uuid,p_proposta_id uuid)
returns table(modo text,revisao integer) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_proposta_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select coalesce(c.modo_novo,b.modo),coalesce(c.revisao,1) from financeiro.sso_modo_faturamento_propostas b
    left join lateral(select x.modo_novo,x.revisao from financeiro.sso_modo_faturamento_correcoes x where x.proposta_id=b.proposta_id order by x.revisao desc limit 1) c on true
    where b.proposta_id=p_proposta_id and b.cliente_id=p_cliente_id;
end $$;
revoke all on function financeiro.sso_consultar_modo_proposta(uuid,uuid) from public,anon,authenticated,service_role;

-- Atualização após criar as dependências; preserva assinaturas e concessões.
create or replace function financeiro.sso_proteger_modo_faturamento_proposta() returns trigger language plpgsql security definer set search_path='' as $$
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
  select m.cliente_id,coalesce((select c.modo_novo from financeiro.sso_modo_faturamento_correcoes c
    where c.proposta_id=m.proposta_id order by c.revisao desc limit 1),m.modo)
    into v_cliente,v_modo from financeiro.sso_modo_faturamento_propostas m where m.proposta_id=v_proposta;
  if v_cliente is distinct from new.cliente_id or v_modo is distinct from (case when new.origem_tipo='proposta_operacional' then 'integral' else 'linhas' end)
    then raise exception 'modo_faturamento_invalido' using errcode='23514'; end if;
  if new.origem_tipo='material_proposta_linha' and not exists(select 1 from comercial.propostas p where p.id=v_proposta and p.versao_atual=v_versao and p.status='aceita') then raise exception 'versao_obsoleta' using errcode='23514'; end if;
  return new;
end $$;
