create table comercial.sso_decisoes_origem_orcamento(
 request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),os_id uuid not null references pcm.ordens_servico(id),
 proposta_id uuid not null references comercial.propostas(id),versao integer not null check(versao>0),origem text not null check(origem='pcm'),
 decisao text not null check(decisao in ('aceita','recusada')),motivo text not null check(length(btrim(motivo)) between 1 and 2000),
 evidencia_declarada text not null check(length(btrim(evidencia_declarada)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
 unique(proposta_id,versao,origem));
alter table comercial.sso_decisoes_origem_orcamento enable row level security;
alter table comercial.sso_decisoes_origem_orcamento force row level security;
revoke all on comercial.sso_decisoes_origem_orcamento from public,anon,authenticated,service_role;
create trigger sso_decisao_origem_orcamento_imutavel before update or delete on comercial.sso_decisoes_origem_orcamento for each row execute function pcm.sso_proteger_nota_reconciliacao();
create or replace function comercial.sso_decidir_orcamento_pcm(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer,p_decisao text,p_motivo text,p_evidencia text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p comercial.propostas%rowtype; a comercial.sso_decisoes_origem_orcamento%rowtype;
begin
 if not coalesce((select habilitado from comercial.sso_decisao_pcm_orcamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_proposta_id is null or p_versao is null or p_versao<1 or p_decisao is null or p_decisao not in ('aceita','recusada')
 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or p_evidencia is null or length(btrim(p_evidencia)) not between 1 and 1000
 or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-pcm-orcamento:'||p_request_id::text,0));
 select * into a from comercial.sso_decisoes_origem_orcamento where request_id=p_request_id;
 if found then
  if a.ator_id is distinct from auth.uid() or a.cliente_id<>p_cliente_id or a.os_id<>p_os_id or a.proposta_id<>p_proposta_id or a.versao<>p_versao or a.decisao<>p_decisao or a.motivo is distinct from btrim(p_motivo) or a.evidencia_declarada is distinct from btrim(p_evidencia) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return jsonb_build_object('requestId',a.request_id,'propostaId',a.proposta_id,'osId',a.os_id,'versao',a.versao,'decisao',a.decisao,'evidenciaAutenticada',false,'osCriada',false,'cobrancaCriada',false);
 end if;
 select * into p from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
 if not found or p.status<>'enviada' or p.versao_atual<>p_versao then raise exception 'versao_ou_estado_obsoleto' using errcode='40001'; end if;
 if p.valido_ate is not null and p.valido_ate<current_date then raise exception 'proposta_expirada' using errcode='23514'; end if;
 if not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.listas_materiais l on l.id=o.lista_materiais_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id join pcm.ordens_servico os on os.id=p_os_id and os.client_id=p_cliente_id and os.deleted_at is null where o.proposta_id=p_proposta_id and o.ordem_servico_id=p_os_id)
 or not exists(select 1 from comercial.sso_orcamento_publicacoes pub where pub.proposta_id=p_proposta_id and pub.versao=p_versao)
 or not exists(select 1 from comercial.proposta_versoes v where v.proposta_id=p_proposta_id and v.versao=p_versao) then raise exception 'origem_ou_publicacao_indisponivel' using errcode='42501'; end if;
 if p.preco_centavos<p.piso_centavos and (not coalesce((select habilitado from comercial.sso_excecao_preco_gate where id),false) or not exists(select 1 from comercial.sso_excecoes_preco_operacional e where e.proposta_id=p.id and e.versao=p_versao and e.preco_centavos=p.preco_centavos and e.piso_centavos=p.piso_centavos)) then raise exception 'excecao_preco_indisponivel' using errcode='23514'; end if;
 insert into comercial.sso_decisoes_origem_orcamento(request_id,cliente_id,os_id,proposta_id,versao,origem,decisao,motivo,evidencia_declarada,ator_id) values(p_request_id,p_cliente_id,p_os_id,p.id,p_versao,'pcm',p_decisao,btrim(p_motivo),btrim(p_evidencia),auth.uid());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.decisao_pcm_interna','propostas',p.id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'osId',p_os_id,'versao',p_versao,'decisao',p_decisao));
 return jsonb_build_object('requestId',p_request_id,'propostaId',p.id,'osId',p_os_id,'versao',p_versao,'decisao',p_decisao,'evidenciaAutenticada',false,'osCriada',false,'cobrancaCriada',false);
end $$;
revoke all on function comercial.sso_decidir_orcamento_pcm(uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
create function comercial.sso_consultar_decisao_pcm_orcamento(p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer)
returns table(decisao text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from comercial.sso_decisao_pcm_orcamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select d.decisao,d.ator_id,d.criado_em from comercial.sso_decisoes_origem_orcamento d where d.cliente_id=p_cliente_id and d.os_id=p_os_id and d.proposta_id=p_proposta_id and d.versao=p_versao and d.origem='pcm';
end $$;
revoke all on function comercial.sso_consultar_decisao_pcm_orcamento(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
