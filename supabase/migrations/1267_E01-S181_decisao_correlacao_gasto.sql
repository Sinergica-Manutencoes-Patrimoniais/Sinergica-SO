-- ADR-1115: decisões imutáveis sobre correlações, sem alterar orçamento anterior.
create table comercial.sso_decisao_correlacao_gate (
 id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into comercial.sso_decisao_correlacao_gate(id, habilitado) values (true, false);

create table comercial.sso_decisoes_correlacao_gasto (
 request_id uuid primary key,
 correlacao_request_id uuid not null references comercial.sso_correlacoes_gasto(request_id),
 cliente_id uuid not null references pcm.clientes(id),
 revisao integer not null check (revisao > 0),
 acao text not null check (acao in ('revogar', 'reativar')),
 ator_id uuid not null references auth.users(id),
 motivo text not null check (length(btrim(motivo)) between 1 and 1000),
 payload jsonb not null, resultado jsonb not null,
 criado_em timestamptz not null default now(),
 unique (correlacao_request_id, revisao)
);
alter table comercial.sso_decisao_correlacao_gate enable row level security;
alter table comercial.sso_decisao_correlacao_gate force row level security;
alter table comercial.sso_decisoes_correlacao_gasto enable row level security;
alter table comercial.sso_decisoes_correlacao_gasto force row level security;
revoke all on comercial.sso_decisao_correlacao_gate, comercial.sso_decisoes_correlacao_gasto from public, anon, authenticated, service_role;
create trigger sso_decisoes_correlacao_imutaveis before update or delete on comercial.sso_decisoes_correlacao_gasto
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function comercial.sso_decidir_correlacao_gasto(
 p_ator_id uuid, p_cliente_id uuid, p_request_id uuid, p_correlacao_id uuid,
 p_expected_revision integer, p_acao text, p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
 v_corr comercial.sso_correlacoes_gasto%rowtype;
 v_fonte comercial.sso_fontes_custo_aquisicao%rowtype;
 v_lista pcm.listas_materiais%rowtype;
 v_ant comercial.sso_decisoes_correlacao_gasto%rowtype;
 v_rev integer := 0; v_ultima_acao text := 'reativar';
 v_motivo text := nullif(btrim(p_motivo), ''); v_payload jsonb; v_resultado jsonb;
begin
 if current_setting('transaction_isolation') <> 'read committed' then
  raise exception 'isolamento_nao_suportado' using errcode='25001';
 end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null
  or p_request_id is null or p_correlacao_id is null or p_expected_revision is null or p_expected_revision < 0
  or p_acao is null or p_acao not in ('revogar','reativar') or v_motivo is null or length(v_motivo)>1000 then
  raise exception 'parametros_invalidos' using errcode='22023';
 end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
  raise exception 'autorizacao_em_alteracao' using errcode='55P03';
 end if;
 perform 1 from comercial.sso_correlacao_gasto_gate where id and habilitado for share;
 if not found then raise exception 'correlacao_desabilitada' using errcode='55000'; end if;
 perform 1 from comercial.sso_decisao_correlacao_gate where id and habilitado for share;
 if not found then raise exception 'decisao_correlacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'correlacaoId',p_correlacao_id,
  'expectedRevision',p_expected_revision,'acao',p_acao,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-correlacao:'||p_request_id::text,0));
 select * into v_corr from comercial.sso_correlacoes_gasto where request_id=p_correlacao_id and cliente_id=p_cliente_id;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v_fonte from comercial.sso_fontes_custo_aquisicao where id=v_corr.fonte_id and cliente_id=p_cliente_id;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v_lista from pcm.listas_materiais where id=v_fonte.lista_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where id=v_fonte.os_id and id=v_lista.ordem_servico_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from comercial.sso_fontes_custo_aquisicao where id=v_fonte.id and cliente_id=p_cliente_id and lista_id=v_lista.id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('uso-fonte-aquisicao:'||v_fonte.id::text,0));
 perform 1 from pcm.despesas_visita d join pcm.visita_ordens_servico v
  on v.id=v_corr.vinculo_id and v.cliente_id=d.cliente_id and v.visita_id=d.visita_id and v.os_id=v_fonte.os_id
  where d.id=v_corr.despesa_id and d.cliente_id=p_cliente_id for share of d,v;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v_ant from comercial.sso_decisoes_correlacao_gasto where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then
   raise exception 'request_id_conflitante' using errcode='23505';
  end if;
  return v_ant.resultado;
 end if;
 select revisao,acao into v_rev,v_ultima_acao from comercial.sso_decisoes_correlacao_gasto
  where correlacao_request_id=p_correlacao_id order by revisao desc limit 1;
 if not found then v_rev:=0; v_ultima_acao:='reativar'; end if;
 if v_rev is distinct from p_expected_revision then raise exception 'revisao_alterada' using errcode='40001'; end if;
 if p_acao=v_ultima_acao then raise exception 'decisao_incompativel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'correlacaoId',p_correlacao_id,
  'revision',v_rev+1,'estado',case when p_acao='revogar' then 'revogada' else 'ativa' end,'efeitoFinanceiro',false);
 insert into comercial.sso_decisoes_correlacao_gasto(request_id,correlacao_request_id,cliente_id,revisao,acao,ator_id,motivo,payload,resultado)
  values(p_request_id,p_correlacao_id,p_cliente_id,v_rev+1,p_acao,p_ator_id,v_motivo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload)
  values(p_ator_id,'orcamento.correlacao_gasto_decidida','sso_fontes_custo_aquisicao',v_fonte.id,v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function comercial.sso_decidir_correlacao_gasto(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
