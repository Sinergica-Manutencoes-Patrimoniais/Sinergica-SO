create table comercial.sso_revisoes_retificacao_classificacao(id uuid primary key,retificacao_id uuid not null unique references comercial.sso_retificacoes_classificacao_linha(id),
 decisao text not null check(decisao in ('aceita','rejeitada')),motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table comercial.sso_revisoes_retificacao_classificacao enable row level security;
alter table comercial.sso_revisoes_retificacao_classificacao force row level security;
revoke all on comercial.sso_revisoes_retificacao_classificacao from public,anon,authenticated,service_role;
create trigger sso_revisao_retificacao_classificacao_imutavel before update or delete on comercial.sso_revisoes_retificacao_classificacao for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function comercial.sso_revisar_retificacao_classificacao(p_request_id uuid,p_cliente_id uuid,p_retificacao_id uuid,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r comercial.sso_retificacoes_classificacao_linha%rowtype; c comercial.sso_classificacoes_linha%rowtype; a comercial.sso_revisoes_retificacao_classificacao%rowtype;
begin
 if not coalesce((select habilitado from comercial.sso_retificacao_classificacao_gate where id),false) or not coalesce((select habilitado from comercial.sso_classificacao_linha_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_retificacao_id is null or p_decisao is null or p_decisao not in ('aceita','rejeitada') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000 or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('revisao-retificacao-classificacao:'||p_request_id::text,0));
 select * into r from comercial.sso_retificacoes_classificacao_linha where id=p_retificacao_id and cliente_id=p_cliente_id;
 if not found or r.ator_id=auth.uid() then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into a from comercial.sso_revisoes_retificacao_classificacao where id=p_request_id;
 if found then if a.ator_id is distinct from auth.uid() or a.retificacao_id<>p_retificacao_id or a.decisao<>p_decisao or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('revisaoId',a.id,'decisao',a.decisao,'efetivada',false,'geraFaturavel',false); end if;
 select * into c from comercial.sso_classificacoes_linha where id=r.classificacao_id and cliente_id=p_cliente_id;
 if not found then raise exception 'referencia_inconsistente' using errcode='23514'; end if;
 lock table financeiro.itens_faturaveis in share mode;
 perform 1 from comercial.propostas where id=c.proposta_id and deleted_at is null and status='aceita' and versao_atual=c.versao for update;
 if not found then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
 if exists(select 1 from financeiro.itens_faturaveis where cliente_id=p_cliente_id) then raise exception 'itens_cliente_exigem_reconciliacao' using errcode='23514'; end if;
 insert into comercial.sso_revisoes_retificacao_classificacao(id,retificacao_id,decisao,motivo,ator_id) values(p_request_id,p_retificacao_id,p_decisao,btrim(p_motivo),auth.uid());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.retificacao_classificacao_revisada','propostas',c.proposta_id,jsonb_build_object('revisaoId',p_request_id,'retificacaoId',p_retificacao_id,'clienteId',p_cliente_id,'decisao',p_decisao));
 return jsonb_build_object('revisaoId',p_request_id,'decisao',p_decisao,'efetivada',false,'geraFaturavel',false);
end $$;
revoke all on function comercial.sso_revisar_retificacao_classificacao(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
