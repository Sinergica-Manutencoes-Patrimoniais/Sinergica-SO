-- ADR-1064: criação rastreável em rascunho; gate fechado e sem EXECUTE externo.
create table pcm.sso_rascunho_plano_legado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_rascunho_plano_legado_gate(id,habilitado) values(true,false);
create table pcm.sso_rascunhos_planos_legados (
  request_id uuid primary key, cliente_id uuid not null references pcm.clientes(id),
  plano_legado_id uuid not null unique references pcm.planos_preventivos(id),
  plano_id uuid not null unique references pcm.planos_manutencao(id), rotina_id uuid not null unique references pcm.rotinas_manutencao(id),
  versao_id uuid not null references pcm.plano_versoes(id), ator_id uuid not null references auth.users(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now(),
  check(plano_legado_id=plano_id)
);
alter table pcm.sso_rascunho_plano_legado_gate enable row level security;
alter table pcm.sso_rascunho_plano_legado_gate force row level security;
alter table pcm.sso_rascunhos_planos_legados enable row level security;
alter table pcm.sso_rascunhos_planos_legados force row level security;
revoke all on pcm.sso_rascunho_plano_legado_gate,pcm.sso_rascunhos_planos_legados from public,anon,authenticated,service_role;
create trigger sso_rascunhos_planos_legados_imutaveis before update or delete on pcm.sso_rascunhos_planos_legados
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_criar_rascunho_plano_legado(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_plano_legado_id uuid,
  p_rotina_id uuid,p_fotografia jsonb,p_modo text,p_intervalo integer,p_unidade text,p_data_base date,p_tolerancia_antes integer,p_tolerancia_depois integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_origem pcm.planos_preventivos%rowtype;v_ant pcm.sso_rascunhos_planos_legados%rowtype;
  v_payload jsonb;v_plano jsonb;v_rotina jsonb;v_resultado jsonb;v_tipo text;v_alvo uuid;v_versao uuid;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_plano_legado_id is null
    or p_rotina_id is null or jsonb_typeof(p_fotografia) is distinct from 'object' or p_modo is null or p_modo not in ('calendario','visita')
    or p_intervalo is null or p_intervalo<1 or p_unidade is null or p_unidade not in ('dias','semanas','meses','anos')
    or p_data_base is null or not isfinite(p_data_base) or p_tolerancia_antes is null or p_tolerancia_antes<0
    or p_tolerancia_depois is null or p_tolerancia_depois<0 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_rascunho_plano_legado_gate where id and habilitado for share;
  if not found then raise exception 'migracao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.migracao_preflight_gate where id and habilitado for share;
  if not found then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoLegadoId',p_plano_legado_id,'rotinaId',p_rotina_id,'fotografia',p_fotografia,
    'modo',p_modo,'intervalo',p_intervalo,'unidade',p_unidade,'dataBase',p_data_base,'toleranciaAntes',p_tolerancia_antes,'toleranciaDepois',p_tolerancia_depois);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-rascunho-legado-request:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_rascunhos_planos_legados where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    if not exists(select 1 from pcm.planos_preventivos where id=v_ant.plano_legado_id and cliente_id=p_cliente_id)
      or not exists(select 1 from pcm.planos_manutencao where id=v_ant.plano_id and cliente_id=p_cliente_id) then raise exception 'origem_indisponivel' using errcode='42501'; end if;
    return v_ant.resultado;
  end if;
  select * into v_origem from pcm.planos_preventivos where id=p_plano_legado_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
  if to_jsonb(v_origem) is distinct from p_fotografia then raise exception 'origem_alterada' using errcode='40001'; end if;
  if exists(select 1 from pcm.sso_rascunhos_planos_legados where plano_legado_id=p_plano_legado_id)
    or exists(select 1 from pcm.planos_manutencao where id=p_plano_legado_id) then raise exception 'plano_existente_exige_reconciliacao' using errcode='23505'; end if;
  if num_nonnulls(v_origem.sistema_id,v_origem.equipamento_id)<>1 then raise exception 'alvo_invalido' using errcode='23514'; end if;
  v_tipo:=case when v_origem.sistema_id is not null then 'sistema' else 'componente' end;
  v_alvo:=coalesce(v_origem.sistema_id,v_origem.equipamento_id);
  v_plano:=pcm.sso_salvar_plano_rascunho(gen_random_uuid(),0,p_plano_legado_id,p_cliente_id,v_origem.nome);
  if v_plano->>'aggregateId' is distinct from p_plano_legado_id::text or v_plano->>'state' is distinct from 'rascunho'
    or (v_plano->>'revision')::integer<>1 then raise exception 'recibo_plano_invalido' using errcode='23514'; end if;
  v_rotina:=pcm.sso_adicionar_rotina_rascunho_v2(gen_random_uuid(),1,p_plano_legado_id,p_rotina_id,v_origem.nome,v_tipo,v_alvo,
    p_modo,p_intervalo,p_unidade,p_data_base,null,p_tolerancia_antes,p_tolerancia_depois,null,v_origem.questionario_id,null);
  if v_rotina->>'aggregateId' is distinct from p_plano_legado_id::text or v_rotina->>'state' is distinct from 'rascunho'
    or v_rotina#>>'{linkedIds,rotinaId}' is distinct from p_rotina_id::text then raise exception 'recibo_rotina_invalido' using errcode='23514'; end if;
  v_versao:=(v_rotina#>>'{linkedIds,versaoId}')::uuid;
  if not exists(select 1 from pcm.plano_versoes where id=v_versao and plano_id=p_plano_legado_id and numero=1 and estado='rascunho') then raise exception 'versao_invalida' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'aggregateId',p_plano_legado_id,'revision',(v_rotina->>'revision')::integer,
    'state','rascunho','created',true,'linkedIds',jsonb_build_object('clienteId',p_cliente_id,'planoLegadoId',p_plano_legado_id,'versaoId',v_versao,'rotinaId',p_rotina_id),
    'warnings',jsonb_build_array('tempo_a_validar','tipo_tarefa_a_mapear','aprovacao_pendente','equivalencia_nao_comprovada'));
  insert into pcm.sso_rascunhos_planos_legados(request_id,cliente_id,plano_legado_id,plano_id,rotina_id,versao_id,ator_id,payload,resultado)
    values(p_request_id,p_cliente_id,p_plano_legado_id,p_plano_legado_id,p_rotina_id,v_versao,p_ator_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'migracao.rascunho_plano_legado','planos_manutencao',p_plano_legado_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'versaoId',v_versao,'rotinaId',p_rotina_id));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_criar_rascunho_plano_legado(uuid,uuid,uuid,uuid,uuid,jsonb,text,integer,text,date,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_fotografia_plano_legado(p_ator_id uuid,p_cliente_id uuid,p_plano_legado_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_origem pcm.planos_preventivos%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_plano_legado_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_rascunho_plano_legado_gate where id and habilitado for share;
  if not found then raise exception 'migracao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.migracao_preflight_gate where id and habilitado for share;
  if not found then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_origem from pcm.planos_preventivos where id=p_plano_legado_id and cliente_id=p_cliente_id for share;
  if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
  return jsonb_build_object('clienteId',p_cliente_id,'planoLegadoId',p_plano_legado_id,'fotografia',to_jsonb(v_origem),
    'rascunhoExistente',exists(select 1 from pcm.planos_manutencao where id=p_plano_legado_id),'equivalenciaComprovada',false);
end; $$;
revoke all on function pcm.sso_consultar_fotografia_plano_legado(uuid,uuid,uuid) from public,anon,authenticated,service_role;
