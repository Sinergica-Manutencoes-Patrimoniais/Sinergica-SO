-- ADR-1666: recuperação exclusivamente de recibo já existente.
-- A verificação de permissões é a da 1807; o mesmo owner é obrigatório.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_proc f join pg_catalog.pg_roles r on r.oid=f.proowner
   where f.oid='pcm.sso_iniciar_revisao_contratos_mediada(uuid,uuid,uuid,uuid,integer,uuid,text)'::regprocedure
   and f.prosecdef and r.rolname=current_user and (r.rolsuper or r.rolbypassrls)) then
  raise exception 'owner_1807_incompativel' using errcode='42501';end if;
end $$;
create function pcm.sso_consultar_recibo_revisao_contratos(
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
 raise exception 'recibo_nao_encontrado' using errcode='P0002';
end $$;
revoke all on function pcm.sso_consultar_recibo_revisao_contratos(uuid,uuid,uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_recibo_revisao_contratos(uuid,uuid,uuid,uuid,integer,uuid,text) to authenticated;
