create table comercial.sso_retificacao_classificacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_retificacao_classificacao_gate(id,habilitado) values(true,false);
alter table comercial.sso_retificacao_classificacao_gate enable row level security;
alter table comercial.sso_retificacao_classificacao_gate force row level security;
revoke all on comercial.sso_retificacao_classificacao_gate from public,anon,authenticated,service_role;
create table comercial.sso_retificacoes_classificacao_linha(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),classificacao_id uuid not null unique references comercial.sso_classificacoes_linha(id),
 tipo_proposto text not null check(tipo_proposto in ('servico','material')),motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table comercial.sso_retificacoes_classificacao_linha enable row level security;
alter table comercial.sso_retificacoes_classificacao_linha force row level security;
revoke all on comercial.sso_retificacoes_classificacao_linha from public,anon,authenticated,service_role;
create trigger sso_retificacao_classificacao_linha_imutavel before update or delete on comercial.sso_retificacoes_classificacao_linha for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function comercial.sso_solicitar_retificacao_classificacao(p_request_id uuid,p_cliente_id uuid,p_classificacao_id uuid,p_tipo text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c comercial.sso_classificacoes_linha%rowtype; a comercial.sso_retificacoes_classificacao_linha%rowtype;
begin
 if not coalesce((select habilitado from comercial.sso_retificacao_classificacao_gate where id),false) or not coalesce((select habilitado from comercial.sso_classificacao_linha_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_classificacao_id is null or p_tipo is null or p_tipo not in ('servico','material') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('retificacao-classificacao:'||p_request_id::text,0));
 select * into a from comercial.sso_retificacoes_classificacao_linha where id=p_request_id;
 if found then if a.ator_id is distinct from auth.uid() or a.cliente_id<>p_cliente_id or a.classificacao_id<>p_classificacao_id or a.tipo_proposto<>p_tipo or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('retificacaoId',a.id,'efetivada',false,'geraFaturavel',false); end if;
 select * into c from comercial.sso_classificacoes_linha where id=p_classificacao_id and cliente_id=p_cliente_id;
 if not found or c.tipo=p_tipo then raise exception 'referencia_ou_tipo_invalido' using errcode='23514'; end if;
 lock table financeiro.itens_faturaveis in share mode;
 perform 1 from comercial.propostas where id=c.proposta_id and deleted_at is null and status='aceita' and versao_atual=c.versao for update;
 if not found then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
 if exists(select 1 from financeiro.itens_faturaveis where cliente_id=p_cliente_id) then raise exception 'itens_cliente_exigem_reconciliacao' using errcode='23514'; end if;
 insert into comercial.sso_retificacoes_classificacao_linha(id,cliente_id,classificacao_id,tipo_proposto,motivo,ator_id) values(p_request_id,p_cliente_id,c.id,p_tipo,btrim(p_motivo),auth.uid());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.retificacao_classificacao_solicitada','propostas',c.proposta_id,jsonb_build_object('retificacaoId',p_request_id,'classificacaoId',c.id,'clienteId',p_cliente_id,'tipoProposto',p_tipo));
 return jsonb_build_object('retificacaoId',p_request_id,'efetivada',false,'geraFaturavel',false);
end $$;
revoke all on function comercial.sso_solicitar_retificacao_classificacao(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
