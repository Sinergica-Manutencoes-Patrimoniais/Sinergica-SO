create table financeiro.sso_reconciliacao_servico_material_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_reconciliacao_servico_material_gate(id,habilitado) values(true,false);
alter table financeiro.sso_reconciliacao_servico_material_gate enable row level security;
alter table financeiro.sso_reconciliacao_servico_material_gate force row level security;
revoke all on financeiro.sso_reconciliacao_servico_material_gate from public,anon,authenticated,service_role;
create table financeiro.sso_reconciliacoes_servico_material(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),
 servico_id uuid not null references financeiro.sso_servicos_extra_declarados(id),material_id uuid not null references financeiro.sso_material_declaracoes(id),
 revisao integer not null check(revisao>0),decisao text not null check(decisao in ('possivel_duplicidade','distintos_declarados','inconclusivo')),
 motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(servico_id,material_id,revisao));
alter table financeiro.sso_reconciliacoes_servico_material enable row level security;
alter table financeiro.sso_reconciliacoes_servico_material force row level security;
revoke all on financeiro.sso_reconciliacoes_servico_material from public,anon,authenticated,service_role;
create trigger sso_reconciliacao_servico_material_imutavel before update or delete on financeiro.sso_reconciliacoes_servico_material for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function financeiro.sso_decidir_reconciliacao_servico_material(p_request_id uuid,p_cliente_id uuid,p_servico_id uuid,p_material_id uuid,p_expected_revision integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a financeiro.sso_reconciliacoes_servico_material%rowtype; atual integer;
begin
 if not coalesce((select habilitado from financeiro.sso_reconciliacao_servico_material_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_servico_id is null or p_material_id is null or p_expected_revision is null or p_expected_revision<0
 or p_decisao is null or p_decisao not in ('possivel_duplicidade','distintos_declarados','inconclusivo') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
 or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-servico-material-request:'||p_request_id::text,0));
 select * into a from financeiro.sso_reconciliacoes_servico_material where id=p_request_id;
 if found then
  if a.ator_id is distinct from auth.uid() or a.cliente_id<>p_cliente_id or a.servico_id<>p_servico_id or a.material_id<>p_material_id or a.revisao<>p_expected_revision+1 or a.decisao<>p_decisao or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return jsonb_build_object('requestId',a.id,'revision',a.revisao,'autorizaFaturamento',false);
 end if;
 if not exists(select 1 from financeiro.sso_servicos_extra_declarados s join financeiro.sso_material_declaracoes m on m.cliente_id=s.cliente_id and m.os_id=s.os_id where s.id=p_servico_id and m.id=p_material_id and s.cliente_id=p_cliente_id) then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reconciliacao-servico-material-par:'||p_servico_id::text||':'||p_material_id::text,0));
 select coalesce(max(revisao),0) into atual from financeiro.sso_reconciliacoes_servico_material where servico_id=p_servico_id and material_id=p_material_id;
 if atual<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 insert into financeiro.sso_reconciliacoes_servico_material(id,cliente_id,servico_id,material_id,revisao,decisao,motivo,ator_id) values(p_request_id,p_cliente_id,p_servico_id,p_material_id,atual+1,p_decisao,btrim(p_motivo),auth.uid());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.reconciliacao_declarada','sso_servicos_extra_declarados',p_servico_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'materialId',p_material_id,'revision',atual+1,'decisao',p_decisao));
 return jsonb_build_object('requestId',p_request_id,'revision',atual+1,'autorizaFaturamento',false);
end $$;
revoke all on function financeiro.sso_decidir_reconciliacao_servico_material(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
create function financeiro.sso_listar_reconciliacoes_servico_material(p_cliente_id uuid,p_servico_id uuid,p_material_id uuid,p_antes integer,p_limite integer)
returns table(id uuid,revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from financeiro.sso_reconciliacao_servico_material_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 if not exists(select 1 from financeiro.sso_servicos_extra_declarados s join financeiro.sso_material_declaracoes m on m.cliente_id=s.cliente_id and m.os_id=s.os_id where s.id=p_servico_id and m.id=p_material_id and s.cliente_id=p_cliente_id) then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
 return query select r.id,r.revisao,r.decisao,r.motivo,r.ator_id,r.criado_em from financeiro.sso_reconciliacoes_servico_material r where r.cliente_id=p_cliente_id and r.servico_id=p_servico_id and r.material_id=p_material_id and (p_antes is null or r.revisao<p_antes) order by r.revisao desc limit p_limite;
end $$;
revoke all on function financeiro.sso_listar_reconciliacoes_servico_material(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
