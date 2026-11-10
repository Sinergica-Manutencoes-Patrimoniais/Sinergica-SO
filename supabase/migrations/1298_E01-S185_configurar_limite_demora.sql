-- ADR-1131: configurar somente o limite, sem ativar observação ou jobs.
alter table pcm.sso_demora_fila_config add column revisao integer not null default 0 check(revisao>=0);
create table pcm.sso_config_demora_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_config_demora_gate(id,habilitado) values(true,false);
create table pcm.sso_config_demora_comandos(request_id uuid primary key,ator_id uuid not null references auth.users(id),
 revisao integer not null check(revisao>0),limite_minutos integer not null check(limite_minutos between 1 and 10080),
 motivo text not null check(length(btrim(motivo)) between 1 and 1000),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_config_demora_gate enable row level security;alter table pcm.sso_config_demora_gate force row level security;
alter table pcm.sso_config_demora_comandos enable row level security;alter table pcm.sso_config_demora_comandos force row level security;
revoke all on pcm.sso_config_demora_gate,pcm.sso_config_demora_comandos from public,anon,authenticated,service_role;
create trigger sso_config_demora_comandos_imutaveis before update or delete on pcm.sso_config_demora_comandos for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function pcm.sso_configurar_limite_demora(p_ator_id uuid,p_request_id uuid,p_expected_revision integer,p_limite_minutos integer,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_config_demora_comandos%rowtype;v_config pcm.sso_demora_fila_config%rowtype;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_expected_revision is null or p_expected_revision<0
  or p_limite_minutos is null or p_limite_minutos not between 1 and 10080 or v_motivo is null or length(v_motivo)>1000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_config_demora_gate where id and habilitado for share;
 if not found then raise exception 'configuracao_desabilitada' using errcode='55000'; end if;
 if coalesce(auth.jwt()->>'user_role','')<>'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('expectedRevision',p_expected_revision,'limiteMinutos',p_limite_minutos,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-config-demora:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_config_demora_comandos where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return v_ant.resultado;
 end if;
 select * into v_config from pcm.sso_demora_fila_config where id for update;
 if not found or v_config.revisao is distinct from p_expected_revision then raise exception 'revisao_alterada' using errcode='40001'; end if;
 if coalesce(auth.jwt()->>'user_role','')<>'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
 update pcm.sso_demora_fila_config set limite_minutos=p_limite_minutos,revisao=revisao+1 where id returning * into v_config;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'revision',v_config.revisao,'limiteMinutos',v_config.limite_minutos,'observacaoAtivada',v_config.habilitado,'jobAlterado',false);
 insert into pcm.sso_config_demora_comandos(request_id,ator_id,revisao,limite_minutos,motivo,payload,resultado) values(p_request_id,p_ator_id,v_config.revisao,p_limite_minutos,v_motivo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'integracao.limite_demora_configurado','sso_config_demora_comandos',p_request_id,v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_configurar_limite_demora(uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
