-- ADR-1665: borda única, fechada por padrão; preserva as funções privadas.
do $$
begin
 if not exists (select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
  raise exception 'owner_requer_bypassrls' using errcode='42501';
 end if;
 if not has_schema_privilege(current_user,'pcm','USAGE')
  or not has_function_privilege(current_user,'pcm.sso_serializar_autorizacao_rotina()','EXECUTE')
  or not has_function_privilege(current_user,'pcm.sso_iniciar_revisao_plano_com_contratos(uuid,uuid,uuid,integer,uuid)','EXECUTE')
  or not has_function_privilege(current_user,'pcm.sso_iniciar_revisao_plano_com_evidencias(uuid,uuid,uuid,integer,uuid)','EXECUTE')
  or not has_function_privilege(current_user,'pcm.sso_iniciar_revisao_com_exigencias(uuid,uuid,uuid,integer,uuid)','EXECUTE') then
  raise exception 'owner_sem_execucao' using errcode='42501';
 end if;
 if not exists(select 1 from pg_catalog.pg_proc f join pg_catalog.pg_roles r on r.oid=f.proowner
   where f.oid='pcm.sso_iniciar_revisao_plano_com_contratos(uuid,uuid,uuid,integer,uuid)'::regprocedure and f.prosecdef
    and (r.rolsuper or r.rolbypassrls)
    and has_schema_privilege(r.oid,'pcm','USAGE')
    and has_function_privilege(r.oid,'pcm.sso_iniciar_revisao_plano(uuid,integer,uuid,uuid)','EXECUTE')
    and has_function_privilege(r.oid,'pcm.sso_configurar_obrigatoriedade_pergunta(uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text)','EXECUTE'))
  or not exists(select 1 from pg_catalog.pg_proc f join pg_catalog.pg_roles r on r.oid=f.proowner
   where f.oid='pcm.sso_iniciar_revisao_plano_com_evidencias(uuid,uuid,uuid,integer,uuid)'::regprocedure and f.prosecdef
    and (r.rolsuper or r.rolbypassrls)
    and has_schema_privilege(r.oid,'pcm','USAGE')
    and has_function_privilege(r.oid,'pcm.sso_iniciar_revisao_plano_com_contratos(uuid,uuid,uuid,integer,uuid)','EXECUTE')
    and has_function_privilege(r.oid,'pcm.sso_configurar_evidencia_pergunta(uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text)','EXECUTE'))
  or not exists(select 1 from pg_catalog.pg_proc f join pg_catalog.pg_roles r on r.oid=f.proowner
   where f.oid='pcm.sso_iniciar_revisao_com_exigencias(uuid,uuid,uuid,integer,uuid)'::regprocedure and f.prosecdef
    and (r.rolsuper or r.rolbypassrls)
    and has_schema_privilege(r.oid,'pcm','USAGE')
    and has_function_privilege(r.oid,'pcm.sso_iniciar_revisao_plano_com_evidencias(uuid,uuid,uuid,integer,uuid)','EXECUTE')) then
  raise exception 'owner_nucleo_incompativel' using errcode='42501';
 end if;
end $$;
create table pcm.sso_inicio_revisao_contratos_mediado_gate (
 id boolean primary key default true check(id), habilitado boolean not null default false
);
insert into pcm.sso_inicio_revisao_contratos_mediado_gate(id,habilitado) values(true,false);
alter table pcm.sso_inicio_revisao_contratos_mediado_gate enable row level security;
alter table pcm.sso_inicio_revisao_contratos_mediado_gate force row level security;
revoke all on pcm.sso_inicio_revisao_contratos_mediado_gate from public,anon,authenticated,service_role;

-- Privilégios efetivos necessários aos acessos diretos e às travas de linha.
do $preflight$
declare r record; t text;
begin
 foreach t in array array[
  'pcm.sso_inicio_revisao_contratos_mediado_gate','pcm.sso_revisao_contrato_gate',
  'pcm.sso_contrato_pergunta_gate','pcm.sso_revisao_evidencia_gate',
  'pcm.sso_contrato_evidencia_gate','pcm.sso_revisao_exigencias_gate','pcm.sso_exigencia_legal_gate'
 ] loop
  if not has_table_privilege(current_user,t,'SELECT') or not has_table_privilege(current_user,t,'UPDATE') then
   raise exception 'owner_sem_trava_gate' using errcode='42501';end if;
 end loop;
 foreach t in array array['pcm.sso_revisoes_plano_contratos','pcm.sso_revisoes_plano_evidencias','pcm.sso_revisoes_plano_exigencias'] loop
  if not has_table_privilege(current_user,t,'SELECT') then raise exception 'owner_sem_leitura_recibo' using errcode='42501';end if;
 end loop;
 if not has_schema_privilege(current_user,'config','USAGE')
  or not has_schema_privilege(current_user,'auth','USAGE')
  or not has_function_privilege(current_user,'config.sso_autorizar_acao(text,uuid)','EXECUTE')
  or not has_function_privilege(current_user,'auth.uid()','EXECUTE') then
  raise exception 'owner_sem_autenticacao_autorizacao' using errcode='42501';end if;
 if not has_table_privilege(current_user,'pcm.planos_manutencao','SELECT')
  or not has_table_privilege(current_user,'pcm.planos_manutencao','UPDATE') then
  raise exception 'owner_sem_trava_plano' using errcode='42501';end if;
 for r in select f.proowner owner_id, f.oid::regprocedure::text nome
  from pg_catalog.pg_proc f where f.oid in (
   'pcm.sso_iniciar_revisao_plano_com_contratos(uuid,uuid,uuid,integer,uuid)'::regprocedure,
   'pcm.sso_iniciar_revisao_plano_com_evidencias(uuid,uuid,uuid,integer,uuid)'::regprocedure,
   'pcm.sso_iniciar_revisao_com_exigencias(uuid,uuid,uuid,integer,uuid)'::regprocedure)
 loop
  if not has_schema_privilege(r.owner_id,'config','USAGE')
   or not has_schema_privilege(r.owner_id,'auth','USAGE')
   or not has_function_privilege(r.owner_id,'config.sso_autorizar_acao(text,uuid)','EXECUTE')
   or not has_function_privilege(r.owner_id,'auth.uid()','EXECUTE') then
   raise exception 'owner_nucleo_sem_autenticacao_autorizacao' using errcode='42501';end if;
  if not has_schema_privilege(r.owner_id,'audit','USAGE')
   or not has_table_privilege(r.owner_id,'audit.events','INSERT')
   or not has_table_privilege(r.owner_id,'pcm.planos_manutencao','SELECT')
   or not has_table_privilege(r.owner_id,'pcm.planos_manutencao','UPDATE')
   or not has_table_privilege(r.owner_id,'pcm.plano_versoes','SELECT')
   or not has_table_privilege(r.owner_id,'pcm.plano_versoes','UPDATE') then
   raise exception 'owner_nucleo_sem_privilegios' using errcode='42501';end if;
  if r.nome like '%_com_contratos(%' then
   if not has_table_privilege(r.owner_id,'pcm.sso_revisao_contrato_gate','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_contrato_pergunta_gate','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_revisoes_plano_contratos','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_revisoes_plano_contratos','INSERT')
    or not has_table_privilege(r.owner_id,'pcm.questionarios','SELECT') then
    raise exception 'owner_contratos_sem_privilegios' using errcode='42501';end if;
  elsif r.nome like '%_com_evidencias(%' then
   if not has_table_privilege(r.owner_id,'pcm.sso_revisao_evidencia_gate','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_contrato_evidencia_gate','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_revisoes_plano_evidencias','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_revisoes_plano_evidencias','INSERT')
    or not has_table_privilege(r.owner_id,'pcm.questionarios','SELECT') then
    raise exception 'owner_evidencias_sem_privilegios' using errcode='42501';end if;
  else
   if not has_table_privilege(r.owner_id,'pcm.sso_revisao_exigencias_gate','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_exigencia_legal_gate','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_revisoes_plano_exigencias','SELECT')
    or not has_table_privilege(r.owner_id,'pcm.sso_revisoes_plano_exigencias','INSERT')
    or not has_table_privilege(r.owner_id,'pcm.sso_propostas_exigencia_revisao','INSERT') then
    raise exception 'owner_exigencias_sem_privilegios' using errcode='42501';end if;
  end if;
 end loop;
end; $preflight$;

create function pcm.sso_iniciar_revisao_contratos_mediada(
 p_ator uuid, p_cliente uuid, p_plano uuid, p_request uuid,
 p_expected_revision integer, p_nova_versao uuid, p_modo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
 v_payload jsonb; v_existentes integer; v_ator uuid; v_modo text; v_payload_salvo jsonb; v_resultado jsonb;
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 if p_plano is null or p_request is null or p_nova_versao is null or p_expected_revision is null
  or p_expected_revision<1 or p_modo is null or p_modo not in ('contratos','evidencias','exigencias') then
  raise exception 'revisao_invalida' using errcode='22023';
 end if;
 perform 1 from pcm.sso_inicio_revisao_contratos_mediado_gate where id and habilitado for share nowait;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000';end if;
 if p_modo='contratos' then
  perform 1 from pcm.sso_revisao_contrato_gate where id and habilitado for share nowait;
  if not found then raise exception 'revisao_contratos_bloqueada' using errcode='55000';end if;
  perform 1 from pcm.sso_contrato_pergunta_gate where id and habilitado for share nowait;
  if not found then raise exception 'contrato_pergunta_bloqueado' using errcode='55000';end if;
 elsif p_modo='evidencias' then
  perform 1 from pcm.sso_revisao_evidencia_gate where id and habilitado for share nowait;
  if not found then raise exception 'revisao_evidencias_bloqueada' using errcode='55000';end if;
  perform 1 from pcm.sso_contrato_evidencia_gate where id and habilitado for share nowait;
  if not found then raise exception 'contrato_evidencia_bloqueado' using errcode='55000';end if;
 else
  perform 1 from pcm.sso_revisao_exigencias_gate where id and habilitado for share nowait;
  if not found then raise exception 'revisao_exigencias_bloqueada' using errcode='55000';end if;
  perform 1 from pcm.sso_exigencia_legal_gate where id and habilitado for share nowait;
  if not found then raise exception 'exigencia_legal_bloqueada' using errcode='55000';end if;
 end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-revisao-modo:'||p_request::text,0)) then
  raise exception 'request_em_processamento' using errcode='55P03';
 end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente,'planoId',p_plano,'expectedRevision',p_expected_revision,'novaVersaoId',p_nova_versao);
 select count(*) into v_existentes from (
  select request_id from pcm.sso_revisoes_plano_contratos where request_id=p_request
  union all select request_id from pcm.sso_revisoes_plano_evidencias where request_id=p_request
  union all select request_id from pcm.sso_revisoes_plano_exigencias where request_id=p_request
 ) existentes;
 if v_existentes>1 then raise exception 'request_id_conflitante' using errcode='23505';end if;
 if v_existentes=1 then
  select modo,ator_id,payload,resultado into v_modo,v_ator,v_payload_salvo,v_resultado from (
   select 'contratos'::text modo,ator_id,payload,resultado from pcm.sso_revisoes_plano_contratos where request_id=p_request
   union all select 'evidencias'::text,ator_id,payload,resultado from pcm.sso_revisoes_plano_evidencias where request_id=p_request
   union all select 'exigencias'::text,ator_id,payload,resultado from pcm.sso_revisoes_plano_exigencias where request_id=p_request
  ) recibo;
  if v_modo is distinct from p_modo or v_ator is distinct from p_ator or v_payload_salvo is distinct from v_payload then
   raise exception 'request_id_conflitante' using errcode='23505';
  end if;
  return v_resultado;
 end if;
 -- Só pedidos novos executam as cadeias transitivas dos modos anteriores.
 if p_modo in ('evidencias','exigencias') then
  perform 1 from pcm.sso_revisao_contrato_gate where id and habilitado for share nowait;
  if not found then raise exception 'revisao_contratos_bloqueada' using errcode='55000';end if;
  perform 1 from pcm.sso_contrato_pergunta_gate where id and habilitado for share nowait;
  if not found then raise exception 'contrato_pergunta_bloqueado' using errcode='55000';end if;
 end if;
 if p_modo='exigencias' then
  perform 1 from pcm.sso_revisao_evidencia_gate where id and habilitado for share nowait;
  if not found then raise exception 'revisao_evidencias_bloqueada' using errcode='55000';end if;
  perform 1 from pcm.sso_contrato_evidencia_gate where id and habilitado for share nowait;
  if not found then raise exception 'contrato_evidencia_bloqueado' using errcode='55000';end if;
 end if;
 if p_modo='contratos' then
  return pcm.sso_iniciar_revisao_plano_com_contratos(p_request,p_cliente,p_plano,p_expected_revision,p_nova_versao);
 elsif p_modo='evidencias' then
  return pcm.sso_iniciar_revisao_plano_com_evidencias(p_request,p_cliente,p_plano,p_expected_revision,p_nova_versao);
 end if;
 return pcm.sso_iniciar_revisao_com_exigencias(p_request,p_cliente,p_plano,p_expected_revision,p_nova_versao);
end $$;
revoke all on function pcm.sso_iniciar_revisao_contratos_mediada(uuid,uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_iniciar_revisao_contratos_mediada(uuid,uuid,uuid,uuid,integer,uuid,text) to authenticated;
