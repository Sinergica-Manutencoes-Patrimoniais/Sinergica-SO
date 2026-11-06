-- ADR-0487: preserva decisões, falha fechado se existir proposta.
create table pcm.sso_trava_reclassificacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_trava_reclassificacao_gate(id,habilitado) values(true,false);
create table pcm.sso_reaberturas_reclassificacao(request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),retorno_id uuid not null references pcm.retorno_os_preparado(id),revisao_anterior integer not null,revisao_nova integer not null,motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_trava_reclassificacao_gate enable row level security;alter table pcm.sso_trava_reclassificacao_gate force row level security;
alter table pcm.sso_reaberturas_reclassificacao enable row level security;alter table pcm.sso_reaberturas_reclassificacao force row level security;
revoke all on pcm.sso_trava_reclassificacao_gate,pcm.sso_reaberturas_reclassificacao from public,anon,authenticated,service_role;
create trigger sso_reaberturas_reclassificacao_imutaveis before update or delete on pcm.sso_reaberturas_reclassificacao for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_reabrir_retorno_para_reclassificacao(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_expected_revision integer,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_r pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_reaberturas_reclassificacao%rowtype;v_payload jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_trava_reclassificacao_gate where id),false) then raise exception 'reabertura_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_expected_revision is null or p_expected_revision<0 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'revision',p_expected_revision,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reabrir-reclassificacao:'||p_request_id::text,0));
 select * into v_r from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_reaberturas_reclassificacao where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado; end if;
 perform pcm.sso_decidir_retorno_versionado(p_request_id,p_cliente_id,p_retorno_id,p_expected_revision,'reabrir',btrim(p_motivo));
 v_resultado:=jsonb_build_object('requestId',p_request_id,'retornoId',p_retorno_id,'revision',p_expected_revision+1,'respostaEfetivada',false,'historicoPreservado',true);
 insert into pcm.sso_reaberturas_reclassificacao(request_id,cliente_id,retorno_id,revisao_anterior,revisao_nova,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_retorno_id,p_expected_revision,p_expected_revision+1,btrim(p_motivo),auth.uid(),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'execucao.retorno_reaberto_reclassificacao','retorno_os_preparado',p_retorno_id,v_payload||v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_reabrir_retorno_para_reclassificacao(uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
create function pcm.sso_guardar_reclassificacao_pendente() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_trava_reclassificacao_gate where id),false) then return new; end if;
 if tg_table_name='decisoes_validacao_os' then
   if new.decisao<>'aprovar' then return new; end if;
 end if;
 if exists(select 1 from pcm.sso_propostas_reclassificacao_resposta p where p.retorno_id=new.retorno_id) then raise exception 'integracao_reclassificacao_pendente' using errcode='55000'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_reclassificacao_pendente() from public,anon,authenticated,service_role;
create trigger sso_guardar_reclassificacao_pendente before insert on pcm.decisoes_validacao_os for each row execute function pcm.sso_guardar_reclassificacao_pendente();
create trigger sso_guardar_reclassificacao_pendente before insert on pcm.sso_pendencias_tecnicas for each row execute function pcm.sso_guardar_reclassificacao_pendente();
create trigger sso_guardar_reclassificacao_pendente before insert on pcm.sso_finalizacoes_os_validadas for each row execute function pcm.sso_guardar_reclassificacao_pendente();
