create table comercial.sso_classificacao_linha_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_classificacao_linha_gate(id,habilitado) values(true,false);
alter table comercial.sso_classificacao_linha_gate enable row level security;
alter table comercial.sso_classificacao_linha_gate force row level security;
revoke all on comercial.sso_classificacao_linha_gate from public,anon,authenticated,service_role;
create table comercial.sso_classificacoes_linha(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),proposta_id uuid not null,versao integer not null,linha_id uuid not null,
 tipo text not null check(tipo in ('servico','material')),motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
 foreign key(proposta_id,versao) references comercial.sso_itens_publicos_proposta(proposta_id,versao),unique(proposta_id,versao,linha_id));
create table comercial.sso_revisoes_classificacao_linha(id uuid primary key,classificacao_id uuid not null unique references comercial.sso_classificacoes_linha(id),
 decisao text not null check(decisao in ('aceita','rejeitada')),motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table comercial.sso_classificacoes_linha enable row level security;
alter table comercial.sso_classificacoes_linha force row level security;
alter table comercial.sso_revisoes_classificacao_linha enable row level security;
alter table comercial.sso_revisoes_classificacao_linha force row level security;
revoke all on comercial.sso_classificacoes_linha,comercial.sso_revisoes_classificacao_linha from public,anon,authenticated,service_role;
create trigger sso_classificacao_linha_imutavel before update or delete on comercial.sso_classificacoes_linha for each row execute function pcm.sso_proteger_nota_reconciliacao();
create trigger sso_revisao_classificacao_linha_imutavel before update or delete on comercial.sso_revisoes_classificacao_linha for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function comercial.sso_declarar_classificacao_linha(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid,p_versao integer,p_linha_id uuid,p_tipo text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a comercial.sso_classificacoes_linha%rowtype; p comercial.propostas%rowtype;
begin
 if not coalesce((select habilitado from comercial.sso_classificacao_linha_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_proposta_id is null or p_versao is null or p_versao<1 or p_linha_id is null or p_tipo is null or p_tipo not in ('servico','material') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('classificacao-linha:'||p_request_id::text,0));
 select * into a from comercial.sso_classificacoes_linha where id=p_request_id;
 if found then if a.ator_id is distinct from auth.uid() or a.cliente_id<>p_cliente_id or a.proposta_id<>p_proposta_id or a.versao<>p_versao or a.linha_id<>p_linha_id or a.tipo<>p_tipo or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('classificacaoId',a.id,'aprovada',false,'geraFaturavel',false); end if;
 select * into p from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
 if not found or p.status<>'aceita' or p.versao_atual<>p_versao then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.ordens_servico os on os.id=o.ordem_servico_id and os.client_id=p_cliente_id and os.deleted_at is null where o.proposta_id=p_proposta_id)
 or not exists(select 1 from comercial.sso_itens_publicos_proposta s cross join lateral jsonb_array_elements(s.itens) e where s.proposta_id=p_proposta_id and s.versao=p_versao and e->>'id'=p_linha_id::text) then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
 insert into comercial.sso_classificacoes_linha(id,cliente_id,proposta_id,versao,linha_id,tipo,motivo,ator_id) values(p_request_id,p_cliente_id,p_proposta_id,p_versao,p_linha_id,p_tipo,btrim(p_motivo),auth.uid());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.classificacao_linha_declarada','propostas',p_proposta_id,jsonb_build_object('classificacaoId',p_request_id,'clienteId',p_cliente_id,'versao',p_versao,'linhaId',p_linha_id,'tipo',p_tipo));
 return jsonb_build_object('classificacaoId',p_request_id,'aprovada',false,'geraFaturavel',false);
end $$;
revoke all on function comercial.sso_declarar_classificacao_linha(uuid,uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
create function comercial.sso_revisar_classificacao_linha(p_request_id uuid,p_cliente_id uuid,p_classificacao_id uuid,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c comercial.sso_classificacoes_linha%rowtype; a comercial.sso_revisoes_classificacao_linha%rowtype;
begin
 if not coalesce((select habilitado from comercial.sso_classificacao_linha_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_classificacao_id is null or p_decisao is null or p_decisao not in ('aceita','rejeitada') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('revisao-classificacao-linha:'||p_request_id::text,0));
 select * into c from comercial.sso_classificacoes_linha where id=p_classificacao_id and cliente_id=p_cliente_id;
 if not found or c.ator_id=auth.uid() then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into a from comercial.sso_revisoes_classificacao_linha where id=p_request_id;
 if found then if a.ator_id is distinct from auth.uid() or a.classificacao_id<>c.id or a.decisao<>p_decisao or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('revisaoId',a.id,'decisao',a.decisao,'geraFaturavel',false); end if;
 perform 1 from comercial.propostas where id=c.proposta_id and deleted_at is null and status='aceita' and versao_atual=c.versao for update;
 if not found then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
 insert into comercial.sso_revisoes_classificacao_linha(id,classificacao_id,decisao,motivo,ator_id) values(p_request_id,c.id,p_decisao,btrim(p_motivo),auth.uid());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.classificacao_linha_revisada','propostas',c.proposta_id,jsonb_build_object('revisaoId',p_request_id,'classificacaoId',c.id,'clienteId',p_cliente_id,'decisao',p_decisao));
 return jsonb_build_object('revisaoId',p_request_id,'decisao',p_decisao,'geraFaturavel',false);
end $$;
revoke all on function comercial.sso_revisar_classificacao_linha(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
