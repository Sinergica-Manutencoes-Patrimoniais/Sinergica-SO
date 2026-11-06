-- ADR-1464: conferência explícita do candidato de serviço após reconferir a origem.
create table financeiro.sso_conferencia_candidato_servico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_conferencia_candidato_servico_gate(id,habilitado) values(true,false);
create table financeiro.sso_conferencia_candidato_servico_tokens(txid bigint not null,ator_id uuid not null,item_id uuid not null,valor_centavos bigint not null,revisao integer not null,primary key(txid,ator_id,item_id));
create table financeiro.sso_conferencia_candidato_servico_comandos(request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table financeiro.sso_conferencia_candidato_servico_gate enable row level security;
alter table financeiro.sso_conferencia_candidato_servico_gate force row level security;
alter table financeiro.sso_conferencia_candidato_servico_tokens enable row level security;
alter table financeiro.sso_conferencia_candidato_servico_tokens force row level security;
alter table financeiro.sso_conferencia_candidato_servico_comandos enable row level security;
alter table financeiro.sso_conferencia_candidato_servico_comandos force row level security;
revoke all on financeiro.sso_conferencia_candidato_servico_gate,financeiro.sso_conferencia_candidato_servico_tokens,financeiro.sso_conferencia_candidato_servico_comandos from public,anon,authenticated,service_role;
create trigger sso_conferencia_candidato_servico_comando_imutavel before update or delete on financeiro.sso_conferencia_candidato_servico_comandos for each row execute function pcm.sso_proteger_nota_reconciliacao();

do $migration$
declare v_def text;v_antigo text;v_novo text;
begin
 v_def:=pg_catalog.pg_get_functiondef('financeiro.sso_bloquear_conferencia_servico_pendente()'::regprocedure);
 v_antigo:=$antigo$raise exception 'conferencia_servico_bloqueada' using errcode='55000';$antigo$;
 v_novo:=$novo$if not exists(select 1 from financeiro.sso_conferencia_candidato_servico_tokens t where t.txid=pg_catalog.txid_current() and t.ator_id=auth.uid()
   and t.item_id=old.id and t.revisao=old.revisao and old.status='pendente' and new.status='conferido' and t.valor_centavos=new.valor_conferido_centavos) then
   raise exception 'conferencia_servico_bloqueada' using errcode='55000'; end if;$novo$;
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'guarda_servico_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;

create function financeiro.sso_conferir_candidato_servico(p_request_id uuid,p_cliente_id uuid,p_item_id uuid,p_expected_revision integer,p_atestacao_revision integer,p_valor_centavos bigint,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_item financeiro.itens_faturaveis%rowtype;v_candidato financeiro.sso_candidatos_servico%rowtype;v_ant financeiro.sso_conferencia_candidato_servico_comandos%rowtype;v_payload jsonb;v_previa jsonb;v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_conferencia_candidato_servico_gate where id and habilitado for share;
 if not found then raise exception 'conferencia_servico_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_item_id is null or p_expected_revision is null or p_expected_revision<1
   or p_atestacao_revision is null or p_atestacao_revision<1 or p_valor_centavos is null or p_valor_centavos not between 0 and 9007199254740991
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_parametros_invalidos' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'itemId',p_item_id,'expectedRevision',p_expected_revision,'atestacaoRevision',p_atestacao_revision,'valorCentavos',p_valor_centavos,'motivo',p_motivo);
 select * into v_ant from financeiro.sso_conferencia_candidato_servico_comandos where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from auth.uid() or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 select * into v_item from financeiro.itens_faturaveis where id=p_item_id and cliente_id=p_cliente_id and origem_tipo='servico_extra_fato';
 if not found then raise exception 'item_indisponivel' using errcode='42501'; end if;
 select * into v_candidato from financeiro.sso_candidatos_servico where item_id=p_item_id and cliente_id=p_cliente_id and fato_id=v_item.origem_id;
 if not found then raise exception 'origem_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from financeiro.sso_faturavel_comandos where request_id=p_request_id) then raise exception 'request_conflitante' using errcode='23505'; end if;
 if v_item.status<>'pendente' or v_item.revisao<>p_expected_revision then raise exception 'revisao_ou_estado_invalido' using errcode='40001'; end if;
 v_previa:=financeiro.sso_criar_candidato_servico(gen_random_uuid(),p_cliente_id,v_candidato.fato_id,p_atestacao_revision,v_item.competencia);
 if v_previa->>'itemId' is distinct from p_item_id::text or v_previa->>'estado' is distinct from 'pendente' or v_previa->>'valorCentavos' is distinct from v_item.valor_original_centavos::text then
   raise exception 'origem_alterada' using errcode='40001'; end if;
 insert into financeiro.sso_conferencia_candidato_servico_tokens(txid,ator_id,item_id,valor_centavos,revisao)
   values(pg_catalog.txid_current(),auth.uid(),p_item_id,p_valor_centavos,p_expected_revision);
 v_resultado:=financeiro.sso_conferir_ou_cancelar_faturavel(p_request_id,p_item_id,p_expected_revision,'conferir',p_valor_centavos,p_motivo);
 delete from financeiro.sso_conferencia_candidato_servico_tokens where txid=pg_catalog.txid_current() and ator_id=auth.uid() and item_id=p_item_id;
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into financeiro.sso_conferencia_candidato_servico_comandos(request_id,ator_id,cliente_id,payload,resultado) values(p_request_id,auth.uid(),p_cliente_id,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function financeiro.sso_conferir_candidato_servico(uuid,uuid,uuid,integer,integer,bigint,text) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_conferir_candidato_servico(uuid,uuid,uuid,integer,integer,bigint,text) to authenticated;
