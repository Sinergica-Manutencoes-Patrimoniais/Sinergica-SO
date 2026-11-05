-- ADR-0971: preparação privada. Não gera execução nem altera a fotografia de origem.
create table pcm.sso_copia_rotina_modelo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_copia_rotina_modelo_gate(id,habilitado) values(true,false);
create table pcm.sso_copias_rotina_modelo(
  request_id uuid primary key, ator_id uuid not null references auth.users(id),
  origem_cliente_id uuid not null references pcm.clientes(id), destino_cliente_id uuid not null references pcm.clientes(id),
  origem_plano_id uuid not null references pcm.planos_manutencao(id), origem_versao_id uuid not null references pcm.plano_versoes(id),
  origem_rotina_id uuid not null, destino_plano_id uuid not null references pcm.planos_manutencao(id),
  destino_rotina_id uuid not null unique,
  snapshot_sha256 text not null check(snapshot_sha256 ~ '^[a-f0-9]{64}$'), payload jsonb not null, resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table pcm.sso_copia_rotina_modelo_gate enable row level security;
alter table pcm.sso_copia_rotina_modelo_gate force row level security;
alter table pcm.sso_copias_rotina_modelo enable row level security;
alter table pcm.sso_copias_rotina_modelo force row level security;
revoke all on pcm.sso_copia_rotina_modelo_gate,pcm.sso_copias_rotina_modelo from public,anon,authenticated,service_role;
create trigger sso_copias_rotina_modelo_imutaveis before update or delete on pcm.sso_copias_rotina_modelo
for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_copiar_rotina_modelo(
  p_request_id uuid,p_ator_esperado uuid,p_origem_cliente_id uuid,p_origem_plano_id uuid,p_origem_revision integer,
  p_origem_versao_id uuid,p_origem_rotina_id uuid,p_destino_cliente_id uuid,p_destino_plano_id uuid,
  p_destino_revision integer,p_destino_rotina_id uuid,p_alvo_tipo text,p_alvo_id uuid
) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare
  v_ator uuid:=auth.uid(); v_origem pcm.planos_manutencao%rowtype; v_destino pcm.planos_manutencao%rowtype; v_versao pcm.plano_versoes%rowtype;
  v_ant pcm.sso_copias_rotina_modelo%rowtype; v_payload jsonb; v_item jsonb; v_rotina record;
  v_total integer; v_criada jsonb; v_resultado jsonb; v_hash text;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_copia_rotina_modelo_gate where id and habilitado for share;
  if not found then raise exception 'copia_rotina_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_ator_esperado is distinct from v_ator or p_request_id is null or p_origem_cliente_id is null
    or p_origem_plano_id is null or p_origem_versao_id is null or p_origem_rotina_id is null or p_origem_revision is null or p_origem_revision<1
    or p_destino_cliente_id is null or p_destino_plano_id is null or p_destino_revision is null or p_destino_revision<1
    or p_destino_rotina_id is null or p_destino_rotina_id=p_origem_rotina_id or p_origem_plano_id=p_destino_plano_id
    or p_alvo_id is null or p_alvo_tipo is null or p_alvo_tipo not in ('sistema','componente','grupo') then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if config.sso_autorizar_acao('plano.gerir',p_origem_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_destino_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('origemClienteId',p_origem_cliente_id,'origemPlanoId',p_origem_plano_id,'origemRevision',p_origem_revision,
    'origemVersaoId',p_origem_versao_id,'origemRotinaId',p_origem_rotina_id,'destinoClienteId',p_destino_cliente_id,
    'destinoPlanoId',p_destino_plano_id,'destinoRevision',p_destino_revision,'destinoRotinaId',p_destino_rotina_id,'alvoTipo',p_alvo_tipo,'alvoId',p_alvo_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('copia-rotina-modelo:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_copias_rotina_modelo where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  -- Compartilha a trava e o namespace do comando reutilizado; não adota criação anterior de outra origem.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-request:'||p_request_id::text,0));
  if exists(select 1 from pcm.plano_comandos where request_id=p_request_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  -- Falha conservadora evita espera circular entre cópias recíprocas; escritores legados ainda requerem revisão.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('copia-planos:'||least(p_origem_plano_id,p_destino_plano_id)::text,0))
    or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('copia-planos:'||greatest(p_origem_plano_id,p_destino_plano_id)::text,0)) then
    raise exception 'planos_em_alteracao' using errcode='55P03';
  end if;
  select * into v_origem from pcm.planos_manutencao where id=p_origem_plano_id and cliente_id=p_origem_cliente_id for share;
  if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
  if v_origem.revisao<>p_origem_revision then raise exception 'origem_obsoleta' using errcode='40001'; end if;
  select * into v_versao from pcm.plano_versoes where id=p_origem_versao_id and plano_id=p_origem_plano_id and estado='aprovado' for share;
  if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
  select count(*),min(x.item::text)::jsonb into v_total,v_item from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item)
    where x.item->>'id'=p_origem_rotina_id::text;
  if v_total<>1 or v_item->>'alvo_tipo' is distinct from p_alvo_tipo then raise exception 'rotina_ou_tipo_invalido' using errcode='23514'; end if;
  select * into v_rotina from jsonb_to_record(v_item) as r(nome text,modo text,intervalo_n integer,intervalo_unidade text,data_base date,
    tempo_minutos integer,tipo_tempo text,tolerancia_antes integer,tolerancia_depois integer,instrucao text,questionario_id uuid);
  if config.sso_autorizar_acao('plano.gerir',p_origem_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_destino_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_destino from pcm.planos_manutencao where id=p_destino_plano_id and cliente_id=p_destino_cliente_id for update;
  if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
  if v_destino.revisao<>p_destino_revision or v_destino.estado<>'rascunho' then raise exception 'destino_obsoleto_ou_nao_editavel' using errcode='40001'; end if;
  v_criada:=pcm.sso_adicionar_rotina_rascunho_interno(p_request_id,p_destino_revision,p_destino_plano_id,p_destino_rotina_id,
    v_rotina.nome,p_alvo_tipo,p_alvo_id,v_rotina.modo,v_rotina.intervalo_n,v_rotina.intervalo_unidade,v_rotina.data_base,
    v_rotina.tempo_minutos,v_rotina.tolerancia_antes,v_rotina.tolerancia_depois,v_rotina.instrucao,v_rotina.questionario_id,v_rotina.tipo_tempo,false);
  v_hash:=encode(sha256(convert_to(v_item::text,'UTF8')),'hex');
  v_resultado:=v_criada||jsonb_build_object('origemPlanoId',p_origem_plano_id,'origemVersaoId',p_origem_versao_id,
    'origemRotinaId',p_origem_rotina_id,'snapshotSha256',v_hash,'questionarioRequerConferencia',true,
    'recorrenciaRequerConferencia',true,'exigenciasRequeremConferencia',true,'execucaoCriada',false);
  insert into pcm.sso_copias_rotina_modelo(request_id,ator_id,origem_cliente_id,destino_cliente_id,origem_plano_id,origem_versao_id,
    origem_rotina_id,destino_plano_id,destino_rotina_id,snapshot_sha256,payload,resultado)
  values(p_request_id,v_ator,p_origem_cliente_id,p_destino_cliente_id,p_origem_plano_id,p_origem_versao_id,
    p_origem_rotina_id,p_destino_plano_id,p_destino_rotina_id,v_hash,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'rotina.modelo_copiado','rotinas_manutencao',p_destino_rotina_id,
    jsonb_build_object('requestId',p_request_id,'origemPlanoId',p_origem_plano_id,'origemVersaoId',p_origem_versao_id,
      'origemRotinaId',p_origem_rotina_id,'destinoPlanoId',p_destino_plano_id,'snapshotSha256',v_hash));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_copiar_rotina_modelo(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,uuid,integer,uuid,text,uuid) from public,anon,authenticated,service_role;
