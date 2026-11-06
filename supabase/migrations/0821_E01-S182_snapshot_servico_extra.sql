-- ADR-0596: snapshot auditável; não cria candidato ou cobrança.
create table financeiro.sso_snapshot_servico_extra_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_snapshot_servico_extra_gate(id,habilitado) values(true,false);
alter table financeiro.sso_snapshot_servico_extra_gate enable row level security;
alter table financeiro.sso_snapshot_servico_extra_gate force row level security;
revoke all on financeiro.sso_snapshot_servico_extra_gate from public,anon,authenticated,service_role;
create table financeiro.sso_snapshots_servico_extra(id uuid primary key,declaracao_id uuid not null unique references financeiro.sso_servicos_extra_declarados(id),
  decisao_id uuid not null references financeiro.sso_servicos_extra_decisoes(id),cliente_id uuid not null references pcm.clientes(id),proposta_id uuid not null references comercial.propostas(id),
  versao integer not null,linha_id uuid not null,quantidade integer not null,linha_publica jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table financeiro.sso_snapshots_servico_extra enable row level security;
alter table financeiro.sso_snapshots_servico_extra force row level security;
revoke all on financeiro.sso_snapshots_servico_extra from public,anon,authenticated,service_role;
create trigger sso_snapshot_servico_extra_imutavel before update or delete on financeiro.sso_snapshots_servico_extra for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function financeiro.sso_registrar_snapshot_servico_extra(p_request_id uuid,p_cliente_id uuid,p_declaracao_id uuid,p_decisao_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d financeiro.sso_servicos_extra_declarados%rowtype; dec financeiro.sso_servicos_extra_decisoes%rowtype; anterior financeiro.sso_snapshots_servico_extra%rowtype;
  p comercial.propostas%rowtype; item jsonb; modo text; qtd numeric;
begin
  if not coalesce((select habilitado from financeiro.sso_servico_extra_gate where id),false) or not coalesce((select habilitado from financeiro.sso_snapshot_servico_extra_gate where id),false)
    or not coalesce((select habilitado from financeiro.sso_modo_faturamento_gate where id),false) or not coalesce((select habilitado from comercial.sso_itens_publicos_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_declaracao_id is null or p_decisao_id is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('snapshot-servico-extra:'||p_request_id::text,0));
  select * into d from financeiro.sso_servicos_extra_declarados where id=p_declaracao_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from financeiro.sso_snapshots_servico_extra where id=p_request_id;
  if found then if anterior.ator_id is distinct from auth.uid() or anterior.cliente_id<>p_cliente_id or anterior.declaracao_id<>p_declaracao_id or anterior.decisao_id<>p_decisao_id then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'estado','snapshot_nao_faturavel','geraFaturavel',false); end if;
  select * into p from comercial.propostas where id=d.proposta_id and deleted_at is null for update;
  if not found or p.status<>'aceita' or p.versao_atual<>d.versao then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
  select * into dec from financeiro.sso_servicos_extra_decisoes where id=p_decisao_id and declaracao_id=d.id;
  if not found or dec.decisao<>'aceita' then raise exception 'decisao_nao_aceita' using errcode='23514'; end if;
  select m.modo into modo from financeiro.sso_consultar_modo_proposta(p_cliente_id,p.id) m;
  if modo is distinct from 'linhas' then raise exception 'modo_incompativel' using errcode='23514'; end if;
  select e into item from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e where s.proposta_id=p.id and s.versao=d.versao and e->>'id'=d.linha_id::text;
  if item is null or item->>'quantidade' is null or item->>'quantidade' !~ '^[1-9][0-9]{0,5}$' or item->>'precoUnitarioCentavos' is distinct from d.preco_unitario_centavos::text then raise exception 'linha_divergente' using errcode='23514'; end if;
  select coalesce((select sum(x.quantidade) from financeiro.sso_material_linha_proposta x where x.proposta_id=p.id and x.versao=d.versao and x.linha_id=d.linha_id),0)
    + coalesce((select sum(x.quantidade) from financeiro.sso_servicos_extra_declarados x join financeiro.sso_servicos_extra_decisoes y on y.declaracao_id=x.id and y.decisao='aceita' where x.proposta_id=p.id and x.versao=d.versao and x.linha_id=d.linha_id),0) into qtd;
  if qtd>(item->>'quantidade')::numeric then raise exception 'quantidade_agregada_excedida' using errcode='23514'; end if;
  insert into financeiro.sso_snapshots_servico_extra(id,declaracao_id,decisao_id,cliente_id,proposta_id,versao,linha_id,quantidade,linha_publica,ator_id)
    values(p_request_id,d.id,dec.id,p_cliente_id,p.id,d.versao,d.linha_id,d.quantidade,item,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.snapshot_servico_extra','ordens_servico',d.os_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'declaracaoId',d.id,'versao',d.versao));
  return jsonb_build_object('requestId',p_request_id,'estado','snapshot_nao_faturavel','geraFaturavel',false);
end $$;
revoke all on function financeiro.sso_registrar_snapshot_servico_extra(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
