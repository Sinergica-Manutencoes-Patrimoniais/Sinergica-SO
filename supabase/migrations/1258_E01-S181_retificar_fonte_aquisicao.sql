-- ADR-1107: substituição aditiva; não altera fonte utilizada.
create table comercial.sso_retificacao_fonte_aquisicao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_retificacao_fonte_aquisicao_gate(id,habilitado) values(true,false);
create table comercial.sso_retificacoes_fonte_aquisicao(
 request_id uuid primary key,fonte_anterior_id uuid not null unique references comercial.sso_fontes_custo_aquisicao(id),
 fonte_nova_id uuid not null unique references comercial.sso_fontes_custo_aquisicao(id),cliente_id uuid not null references pcm.clientes(id),
 ator_id uuid not null references auth.users(id),motivo text not null check(length(btrim(motivo)) between 1 and 1000),
 payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),check(fonte_anterior_id<>fonte_nova_id)
);
alter table comercial.sso_retificacao_fonte_aquisicao_gate enable row level security;alter table comercial.sso_retificacao_fonte_aquisicao_gate force row level security;
alter table comercial.sso_retificacoes_fonte_aquisicao enable row level security;alter table comercial.sso_retificacoes_fonte_aquisicao force row level security;
revoke all on comercial.sso_retificacao_fonte_aquisicao_gate,comercial.sso_retificacoes_fonte_aquisicao from public,anon,authenticated,service_role;
create trigger sso_retificacoes_fonte_aquisicao_imutaveis before update or delete on comercial.sso_retificacoes_fonte_aquisicao for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function comercial.sso_retificar_fonte_aquisicao(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_fonte_anterior_id uuid,p_fonte_nova_id uuid,
 p_lista_id uuid,p_lista_revision integer,p_tipo text,p_descricao text,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant comercial.sso_retificacoes_fonte_aquisicao%rowtype;v_fonte comercial.sso_fontes_custo_aquisicao%rowtype;
 v_lista pcm.listas_materiais%rowtype;v_payload jsonb;v_resultado jsonb;v_criada jsonb;
 v_motivo text:=nullif(btrim(p_motivo),'');v_descricao text:=nullif(btrim(p_descricao),'');
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null
   or p_fonte_anterior_id is null or p_fonte_nova_id is null or p_fonte_anterior_id=p_fonte_nova_id or p_lista_id is null
   or p_lista_revision is null or p_lista_revision<1 or p_tipo is null or p_tipo not in ('material','retirada_exclusiva')
   or v_descricao is null or length(v_descricao)>1000 or v_motivo is null or length(v_motivo)>1000
   or p_valor_centavos is null or p_valor_centavos not between 0 and 1000000000000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from comercial.sso_retificacao_fonte_aquisicao_gate where id and habilitado for share;
 if not found then raise exception 'retificacao_desabilitada' using errcode='55000'; end if;
 perform 1 from comercial.sso_fonte_aquisicao_gate where id and habilitado for share;
 if not found then raise exception 'fonte_aquisicao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('material.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('custo.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'fonteAnteriorId',p_fonte_anterior_id,'fonteNovaId',p_fonte_nova_id,
   'listaId',p_lista_id,'listaRevision',p_lista_revision,'tipo',p_tipo,'descricao',v_descricao,'valorCentavos',p_valor_centavos,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fonte-aquisicao:'||p_request_id::text,0));
 select * into v_lista from pcm.listas_materiais where id=p_lista_id and cliente_id=p_cliente_id for share;
 if not found or v_lista.responsavel<>'sinergica' then raise exception 'lista_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.ordens_servico where id=v_lista.ordem_servico_id and client_id=p_cliente_id and deleted_at is null for share;
 if not found then raise exception 'os_indisponivel' using errcode='42501'; end if;
 select * into v_fonte from comercial.sso_fontes_custo_aquisicao where id=p_fonte_anterior_id and cliente_id=p_cliente_id
   and lista_id=p_lista_id and os_id=v_lista.ordem_servico_id for share;
 if not found then raise exception 'fonte_indisponivel' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('uso-fonte-aquisicao:'||p_fonte_anterior_id::text,0));
 select * into v_ant from comercial.sso_retificacoes_fonte_aquisicao where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 if exists(select 1 from comercial.sso_fontes_custo_aquisicao where request_id=p_request_id)
   or exists(select 1 from comercial.sso_retificacoes_fonte_aquisicao where fonte_anterior_id=p_fonte_anterior_id)
   then raise exception 'fonte_ou_pedido_ja_utilizado' using errcode='23505'; end if;
 if exists(select 1 from comercial.sso_usos_fonte_aquisicao where fonte_id=p_fonte_anterior_id)
   then raise exception 'fonte_utilizada_exige_revisao_orcamento' using errcode='23514'; end if;
 if v_lista.revisao is distinct from p_lista_revision then raise exception 'lista_alterada' using errcode='40001'; end if;
 v_criada:=comercial.sso_declarar_fonte_aquisicao(p_ator_id,p_cliente_id,p_request_id,p_fonte_nova_id,p_lista_id,p_lista_revision,p_tipo,v_descricao,p_valor_centavos);
 v_resultado:=v_criada||jsonb_build_object('fonteAnteriorId',p_fonte_anterior_id,'historicoPreservado',true);
 insert into comercial.sso_retificacoes_fonte_aquisicao(request_id,fonte_anterior_id,fonte_nova_id,cliente_id,ator_id,motivo,payload,resultado)
   values(p_request_id,p_fonte_anterior_id,p_fonte_nova_id,p_cliente_id,p_ator_id,v_motivo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'orcamento.fonte_aquisicao_retificada','sso_fontes_custo_aquisicao',p_fonte_anterior_id,
   jsonb_build_object('requestId',p_request_id,'fonteNovaId',p_fonte_nova_id,'clienteId',p_cliente_id,'motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function comercial.sso_retificar_fonte_aquisicao(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text,bigint,text) from public,anon,authenticated,service_role;
