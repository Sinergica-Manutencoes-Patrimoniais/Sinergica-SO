-- ADR-0970: cópia de fotografia do mesmo Cliente, gate fechado, sem execução.
create table pcm.sso_copia_plano_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_copia_plano_gate(id,habilitado) values(true,false);
create table pcm.sso_copias_plano(
  request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
  origem_plano_id uuid not null references pcm.planos_manutencao(id),origem_versao_id uuid not null references pcm.plano_versoes(id),
  destino_plano_id uuid not null unique references pcm.planos_manutencao(id),destino_versao_id uuid not null unique references pcm.plano_versoes(id),
  snapshot_sha256 text not null check(snapshot_sha256 ~ '^[a-f0-9]{64}$'),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_copia_plano_gate enable row level security;alter table pcm.sso_copia_plano_gate force row level security;
alter table pcm.sso_copias_plano enable row level security;alter table pcm.sso_copias_plano force row level security;
revoke all on pcm.sso_copia_plano_gate,pcm.sso_copias_plano from public,anon,authenticated,service_role;
create trigger sso_copias_plano_imutaveis before update or delete on pcm.sso_copias_plano for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_copiar_plano_aprovado(p_request_id uuid,p_cliente_id uuid,p_origem_plano_id uuid,p_origem_versao_id uuid,
  p_origem_revision integer,p_destino_plano_id uuid,p_destino_versao_id uuid,p_nome text,p_ator_esperado uuid) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_ator uuid:=auth.uid();v_origem pcm.planos_manutencao%rowtype;v_versao pcm.plano_versoes%rowtype;v_ant pcm.sso_copias_plano%rowtype;
  v_item record;v_payload jsonb;v_resultado jsonb;v_mapa jsonb:='[]'::jsonb;v_rotina_id uuid;v_logica_id uuid;v_hash text;v_nome text:=nullif(btrim(p_nome),'');
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_copia_plano_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'copia_plano_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_ator_esperado is distinct from v_ator or p_request_id is null or p_cliente_id is null or p_origem_plano_id is null or p_origem_versao_id is null
    or p_origem_revision is null or p_origem_revision<1 or p_destino_plano_id is null or p_destino_versao_id is null or p_destino_plano_id=p_origem_plano_id
    or v_nome is null or length(v_nome)>200 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('clienteId',p_cliente_id,'origemPlanoId',p_origem_plano_id,'origemVersaoId',p_origem_versao_id,
    'origemRevision',p_origem_revision,'destinoPlanoId',p_destino_plano_id,'destinoVersaoId',p_destino_versao_id,'nome',v_nome);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('copia-plano:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_copias_plano where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  select * into v_origem from pcm.planos_manutencao where id=p_origem_plano_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
  if v_origem.revisao<>p_origem_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_versao from pcm.plano_versoes where id=p_origem_versao_id and plano_id=p_origem_plano_id and estado='aprovado' for share;
  if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' or jsonb_array_length(v_versao.snapshot->'rotinas') not between 1 and 1000 then
    raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(v_versao.snapshot->'rotinas') e(item) where jsonb_typeof(e.item) is distinct from 'object'
      or jsonb_typeof(e.item->'id') is distinct from 'string' or jsonb_typeof(e.item->'rotina_logica_id') is distinct from 'string')
    or (select count(distinct e.item->>'id') from jsonb_array_elements(v_versao.snapshot->'rotinas') e(item))<>jsonb_array_length(v_versao.snapshot->'rotinas')
    or (select count(distinct e.item->>'rotina_logica_id') from jsonb_array_elements(v_versao.snapshot->'rotinas') e(item))<>jsonb_array_length(v_versao.snapshot->'rotinas') then
    raise exception 'snapshot_inconsistente' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_hash:=encode(sha256(convert_to(v_versao.snapshot::text,'UTF8')),'hex');
  insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by,updated_by) values(p_destino_plano_id,p_cliente_id,v_nome,'rascunho',v_ator,v_ator);
  insert into pcm.plano_versoes(id,plano_id,numero,estado,created_by) values(p_destino_versao_id,p_destino_plano_id,1,'rascunho',v_ator);
  for v_item in select * from jsonb_to_recordset(v_versao.snapshot->'rotinas') as r(
    id uuid,rotina_logica_id uuid,nome text,alvo_tipo text,sistema_id uuid,equipamento_id uuid,grupo_id uuid,modo text,intervalo_n integer,
    intervalo_unidade text,data_base date,tempo_minutos integer,tipo_tempo text,tolerancia_antes integer,tolerancia_depois integer,instrucao text,questionario_id uuid) loop
    if v_item.id is null or v_item.rotina_logica_id is null then raise exception 'snapshot_inconsistente' using errcode='23514'; end if;
    v_rotina_id:=gen_random_uuid();v_logica_id:=gen_random_uuid();
    insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,equipamento_id,grupo_id,modo,intervalo_n,
      intervalo_unidade,data_base,tempo_minutos,tipo_tempo,tolerancia_antes,tolerancia_depois,instrucao,questionario_id,created_by)
    values(v_rotina_id,v_logica_id,p_destino_plano_id,p_destino_versao_id,v_item.nome,v_item.alvo_tipo,v_item.sistema_id,v_item.equipamento_id,v_item.grupo_id,
      v_item.modo,v_item.intervalo_n,v_item.intervalo_unidade,v_item.data_base,v_item.tempo_minutos,v_item.tipo_tempo,v_item.tolerancia_antes,v_item.tolerancia_depois,v_item.instrucao,v_item.questionario_id,v_ator);
    v_mapa:=v_mapa||jsonb_build_array(jsonb_build_object('origemRotinaId',v_item.id,'origemLogicaId',v_item.rotina_logica_id,'rotinaId',v_rotina_id,'rotinaLogicaId',v_logica_id));
  end loop;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'planoId',p_destino_plano_id,'versaoId',p_destino_versao_id,'revision',1,
    'estado','rascunho','rotinas',v_mapa,'execucaoCriada',false,'questionariosRequeremConferencia',true);
  insert into pcm.sso_copias_plano(request_id,ator_id,cliente_id,origem_plano_id,origem_versao_id,destino_plano_id,destino_versao_id,snapshot_sha256,payload,resultado)
    values(p_request_id,v_ator,p_cliente_id,p_origem_plano_id,p_origem_versao_id,p_destino_plano_id,p_destino_versao_id,v_hash,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'plano.copiado_rascunho','planos_manutencao',p_destino_plano_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'origemPlanoId',p_origem_plano_id,'origemVersaoId',p_origem_versao_id,'snapshotSha256',v_hash,'rotinas',v_mapa));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_copiar_plano_aprovado(uuid,uuid,uuid,uuid,integer,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
