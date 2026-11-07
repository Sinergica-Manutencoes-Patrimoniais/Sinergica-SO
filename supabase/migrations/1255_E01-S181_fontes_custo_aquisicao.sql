-- ADR-1105: fonte declarada; não cria despesa, pagamento ou faturável.
create table comercial.sso_fonte_aquisicao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_fonte_aquisicao_gate(id,habilitado) values(true,false);
create table comercial.sso_fontes_custo_aquisicao(
 id uuid primary key,cliente_id uuid not null references pcm.clientes(id),lista_id uuid not null references pcm.listas_materiais(id),
 os_id uuid not null references pcm.ordens_servico(id),lista_revisao integer not null check(lista_revisao>0),
 tipo text not null check(tipo in ('material','retirada_exclusiva')),descricao text not null check(length(btrim(descricao)) between 1 and 1000),
 valor_centavos bigint not null check(valor_centavos between 0 and 1000000000000),request_id uuid not null unique,
 ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
create index sso_fontes_aquisicao_lista on comercial.sso_fontes_custo_aquisicao(cliente_id,lista_id,id);
alter table comercial.sso_fonte_aquisicao_gate enable row level security;alter table comercial.sso_fonte_aquisicao_gate force row level security;
alter table comercial.sso_fontes_custo_aquisicao enable row level security;alter table comercial.sso_fontes_custo_aquisicao force row level security;
revoke all on comercial.sso_fonte_aquisicao_gate,comercial.sso_fontes_custo_aquisicao from public,anon,authenticated,service_role;
create trigger sso_fontes_custo_aquisicao_imutaveis before update or delete on comercial.sso_fontes_custo_aquisicao
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function comercial.sso_declarar_fonte_aquisicao(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_fonte_id uuid,
 p_lista_id uuid,p_lista_revision integer,p_tipo text,p_descricao text,p_valor_centavos bigint)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant comercial.sso_fontes_custo_aquisicao%rowtype;v_lista pcm.listas_materiais%rowtype;
 v_descricao text:=nullif(btrim(p_descricao),'');v_payload jsonb;v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_fonte_id is null
   or p_lista_id is null or p_lista_revision is null or p_lista_revision<1 or p_tipo is null or p_tipo not in ('material','retirada_exclusiva')
   or v_descricao is null or length(v_descricao)>1000 or p_valor_centavos is null or p_valor_centavos not between 0 and 1000000000000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_fonte_aquisicao_gate where id and habilitado for share;
 if not found then raise exception 'fonte_aquisicao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'fonteId',p_fonte_id,'listaId',p_lista_id,'listaRevision',p_lista_revision,
   'tipo',p_tipo,'descricao',v_descricao,'valorCentavos',p_valor_centavos);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fonte-aquisicao:'||p_request_id::text,0));
 select * into v_lista from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id for share;
 if not found or v_lista.responsavel<>'sinergica' then raise exception 'lista_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where id=v_lista.ordem_servico_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'os_indisponivel' using errcode='42501'; end if;
 select * into v_ant from comercial.sso_fontes_custo_aquisicao where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 if v_lista.revisao is distinct from p_lista_revision then raise exception 'lista_alterada' using errcode='40001'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'fonteId',p_fonte_id,'listaId',p_lista_id,
   'listaRevision',p_lista_revision,'tipo',p_tipo,'valorCentavos',p_valor_centavos,'despesaVisitaCriada',false,'faturavelCriado',false);
 insert into comercial.sso_fontes_custo_aquisicao(id,cliente_id,lista_id,os_id,lista_revisao,tipo,descricao,valor_centavos,request_id,ator_id,payload,resultado)
   values(p_fonte_id,p_cliente_id,p_lista_id,v_lista.ordem_servico_id,p_lista_revision,p_tipo,v_descricao,p_valor_centavos,p_request_id,p_ator_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'orcamento.fonte_aquisicao_declarada','sso_fontes_custo_aquisicao',p_fonte_id,
   jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'listaId',p_lista_id,'tipo',p_tipo));
 return v_resultado;
end; $$;
revoke all on function comercial.sso_declarar_fonte_aquisicao(uuid,uuid,uuid,uuid,uuid,integer,text,text,bigint) from public,anon,authenticated,service_role;

create function comercial.sso_listar_fontes_aquisicao(p_ator_id uuid,p_cliente_id uuid,p_lista_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,lista_revisao integer,tipo text,descricao text,valor_centavos bigint,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_lista_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_fonte_aquisicao_gate where id and habilitado for share;
 if not found then raise exception 'fonte_aquisicao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.listas_materiais l join pcm.ordens_servico os on os.id=l.ordem_servico_id and os.client_id=l.cliente_id and os.deleted_at is null
   where l.id=p_lista_id and l.cliente_id=p_cliente_id and l.responsavel='sinergica' for share of l,os;
 if not found then raise exception 'lista_indisponivel' using errcode='42501'; end if;
 return query select f.id,f.lista_revisao,f.tipo,f.descricao,f.valor_centavos,f.criado_em
   from comercial.sso_fontes_custo_aquisicao f where f.cliente_id=p_cliente_id and f.lista_id=p_lista_id and (p_apos is null or f.id>p_apos) order by f.id limit p_limite;
end; $$;
revoke all on function comercial.sso_listar_fontes_aquisicao(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
