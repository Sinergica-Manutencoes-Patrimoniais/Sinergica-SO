-- ADR-1110: relação humana entre identidades existentes; não altera valores.
create table comercial.sso_correlacao_gasto_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_correlacao_gasto_gate(id,habilitado) values(true,false);
create table comercial.sso_correlacoes_gasto(
 request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),fonte_id uuid not null references comercial.sso_fontes_custo_aquisicao(id),
 despesa_id uuid not null references pcm.despesas_visita(id),vinculo_id uuid not null references pcm.visita_ordens_servico(id),
 despesa_revisao integer not null check(despesa_revisao>0),rateio_revisao integer not null check(rateio_revisao>0),
 ator_id uuid not null references auth.users(id),motivo text not null check(length(btrim(motivo)) between 1 and 1000),
 payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(fonte_id,despesa_id,vinculo_id)
);
alter table comercial.sso_correlacao_gasto_gate enable row level security;alter table comercial.sso_correlacao_gasto_gate force row level security;
alter table comercial.sso_correlacoes_gasto enable row level security;alter table comercial.sso_correlacoes_gasto force row level security;
revoke all on comercial.sso_correlacao_gasto_gate,comercial.sso_correlacoes_gasto from public,anon,authenticated,service_role;
create trigger sso_correlacoes_gasto_imutaveis before update or delete on comercial.sso_correlacoes_gasto for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function comercial.sso_declarar_correlacao_gasto(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_fonte_id uuid,
 p_despesa_id uuid,p_vinculo_id uuid,p_despesa_revision integer,p_rateio_revision integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_fonte comercial.sso_fontes_custo_aquisicao%rowtype;v_lista pcm.listas_materiais%rowtype;v_d pcm.despesas_visita%rowtype;
 v_ant comercial.sso_correlacoes_gasto%rowtype;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_fonte_id is null or p_despesa_id is null
   or p_vinculo_id is null or p_despesa_revision is null or p_despesa_revision<1 or p_rateio_revision is null or p_rateio_revision<1
   or v_motivo is null or length(v_motivo)>1000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_correlacao_gasto_gate where id and habilitado for share;
 if not found then raise exception 'correlacao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'fonteId',p_fonte_id,'despesaId',p_despesa_id,'vinculoId',p_vinculo_id,
   'despesaRevision',p_despesa_revision,'rateioRevision',p_rateio_revision,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('correlacao-gasto:'||p_request_id::text,0));
 select * into v_fonte from comercial.sso_fontes_custo_aquisicao where id=p_fonte_id and cliente_id=p_cliente_id;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v_lista from pcm.listas_materiais where id=v_fonte.lista_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where id=v_fonte.os_id and id=v_lista.ordem_servico_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from comercial.sso_fontes_custo_aquisicao where id=p_fonte_id and cliente_id=p_cliente_id and lista_id=v_lista.id for share;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('uso-fonte-aquisicao:'||p_fonte_id::text,0));
 select * into v_d from pcm.despesas_visita where id=p_despesa_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.visita_ordens_servico where id=p_vinculo_id and cliente_id=p_cliente_id and visita_id=v_d.visita_id and os_id=v_fonte.os_id for share;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select * into v_ant from comercial.sso_correlacoes_gasto where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 if v_d.revisao is distinct from p_despesa_revision or (select max(revisao) from pcm.despesa_visita_rateios where despesa_id=p_despesa_id) is distinct from p_rateio_revision
   or not exists(select 1 from pcm.despesa_visita_rateio_parcelas where despesa_id=p_despesa_id and revisao=p_rateio_revision and vinculo_id=p_vinculo_id)
   then raise exception 'despesa_ou_rateio_alterado' using errcode='40001'; end if;
 if config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('despesa_visita.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'fonteId',p_fonte_id,'despesaId',p_despesa_id,'vinculoId',p_vinculo_id,'correlacaoDeclarada',true,'efeitoFinanceiro',false);
 insert into comercial.sso_correlacoes_gasto(request_id,cliente_id,fonte_id,despesa_id,vinculo_id,despesa_revisao,rateio_revisao,ator_id,motivo,payload,resultado)
   values(p_request_id,p_cliente_id,p_fonte_id,p_despesa_id,p_vinculo_id,p_despesa_revision,p_rateio_revision,p_ator_id,v_motivo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'orcamento.correlacao_gasto_declarada','sso_fontes_custo_aquisicao',p_fonte_id,
   v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function comercial.sso_declarar_correlacao_gasto(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
