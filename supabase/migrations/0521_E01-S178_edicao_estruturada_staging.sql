-- ADR-0295: somente staging; gate e RPC fechados.
create table pcm.sso_edicao_estruturada_staging_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_edicao_estruturada_staging_gate(id,habilitado) values(true,false);
alter table pcm.sso_edicao_estruturada_staging_gate enable row level security;
alter table pcm.sso_edicao_estruturada_staging_gate force row level security;
revoke all on pcm.sso_edicao_estruturada_staging_gate from public,anon,authenticated,service_role;
create function pcm.sso_editar_atributos_linha_staging(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_chave text,p_antes jsonb,p_alteracoes jsonb,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_lote pcm.sso_levantamentos%rowtype;v_linha pcm.sso_levantamento_linhas%rowtype;v_ant pcm.sso_edicoes_linha_staging%rowtype;v_ciclo integer;v_depois jsonb;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_edicao_estruturada_staging_gate where id),false) then raise exception 'edicao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<1 or p_chave is null or length(btrim(p_chave)) not between 1 and 200 or jsonb_typeof(p_antes) is distinct from 'object' or jsonb_typeof(p_alteracoes) is distinct from 'object' or p_alteracoes='{}'::jsonb or pg_column_size(p_alteracoes)>32768 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each(p_alteracoes) a where a.key not in ('nome','observacoes','quantidade','codigoInformado','referenciaPai','sistemaProvisorio','localProvisorio','classificacao') or jsonb_typeof(a.value) not in ('string','null') or length(coalesce(a.value #>> '{}',''))>4000) then raise exception 'atributos_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('operacao','editar_atributos','loteId',p_lote_id,'expectedRevision',p_expected_revision,'chave',p_chave,'antes',p_antes,'alteracoes',p_alteracoes,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('edicao-linha:'||p_request_id::text,0));
  select * into v_lote from pcm.sso_levantamentos where id=p_lote_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_ant from pcm.sso_edicoes_linha_staging where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('loteId',v_ant.lote_id,'chave',v_ant.linha_chave,'revision',v_ant.revisao,'ciclo',v_ant.ciclo,'requestId',p_request_id);
  end if;
  if v_lote.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if exists(select 1 from pcm.sso_levantamento_incorporacoes where lote_id=p_lote_id) then raise exception 'lote_ja_incorporado' using errcode='23514'; end if;
  select * into v_linha from pcm.sso_levantamento_linhas where lote_id=p_lote_id and chave=p_chave for update;
  if not found or v_linha.atributos is distinct from p_antes or exists(select 1 from pcm.sso_levantamento_rejeicoes where lote_id=p_lote_id and linha_chave=p_chave) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  v_depois:=v_linha.atributos||p_alteracoes;
  if v_depois is not distinct from v_linha.atributos then raise exception 'sem_alteracao' using errcode='22023'; end if;
  select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1)+1 into v_ciclo;
  update pcm.sso_levantamento_linhas set atributos=v_depois where lote_id=p_lote_id and chave=p_chave;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_conferencia_ciclos(lote_id,ciclo,ultima_reabertura_revision) values(p_lote_id,v_ciclo,v_lote.revisao) on conflict(lote_id) do update set ciclo=excluded.ciclo,ultima_reabertura_revision=excluded.ultima_reabertura_revision;
  insert into pcm.sso_conferencia_reaberturas(lote_id,ciclo,revisao,motivo,ator_id,request_id) values(p_lote_id,v_ciclo,v_lote.revisao,btrim(p_motivo),v_ator,gen_random_uuid());
  insert into pcm.sso_edicoes_linha_staging(lote_id,linha_chave,revisao,ciclo,antes,depois,motivo,ator_id,request_id,payload) values(p_lote_id,p_chave,v_lote.revisao,v_ciclo,v_linha.atributos,v_depois,btrim(p_motivo),v_ator,p_request_id,v_payload);
  v_resultado:=jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'ciclo',v_ciclo,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.linha_editada','sso_levantamentos',p_lote_id,v_resultado||jsonb_build_object('clienteId',v_lote.cliente_id,'motivo',btrim(p_motivo),'antes',v_linha.atributos,'depois',v_depois));return v_resultado;
end;
$$;
revoke all on function pcm.sso_editar_atributos_linha_staging(uuid,uuid,integer,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
