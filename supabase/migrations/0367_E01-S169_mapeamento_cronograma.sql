-- ADR-0142: escolhas revisionadas para linhas do staging comum. Não incorpora dados.
create table pcm.sso_cronograma_mapeamentos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null,
  chave_linha text not null,
  revisao_lote integer not null check (revisao_lote > 1),
  disciplina text not null check (length(btrim(disciplina)) between 1 and 200),
  nome_rotina text not null check (length(btrim(nome_rotina)) between 1 and 200),
  alvo_tipo text not null check (alvo_tipo in ('sistema', 'componente', 'grupo')),
  alvo_id uuid not null,
  modo text not null check (modo in ('calendario', 'visita')),
  intervalo_n integer not null check (intervalo_n between 1 and 1000),
  intervalo_unidade text not null check (intervalo_unidade in ('dias','semanas','meses','anos')),
  data_base date,
  tempo_minutos integer check (tempo_minutos > 0),
  premissa_mensal_quatro_semanas text not null check (premissa_mensal_quatro_semanas in ('nao_aplicavel','calendario_real','quatro_semanas')),
  ator_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  foreign key (lote_id, chave_linha) references pcm.sso_levantamento_linhas(lote_id, chave),
  unique (lote_id, revisao_lote),
  check (modo <> 'calendario' or data_base is not null),
  check (data_base is null or isfinite(data_base))
);
create index sso_cronograma_mapeamento_linha_idx on pcm.sso_cronograma_mapeamentos(lote_id,chave_linha,revisao_lote desc);
alter table pcm.sso_cronograma_mapeamentos enable row level security;
alter table pcm.sso_cronograma_mapeamentos force row level security;
revoke all on pcm.sso_cronograma_mapeamentos from public, anon, authenticated, service_role;
create trigger sso_cronograma_mapeamento_imutavel before update or delete on pcm.sso_cronograma_mapeamentos
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_mapear_linha_cronograma(
  p_request_id uuid, p_lote_id uuid, p_expected_revision integer, p_numero_linha integer,
  p_disciplina text, p_nome_rotina text, p_alvo_tipo text, p_alvo_id uuid, p_modo text,
  p_intervalo integer, p_unidade text, p_data_base date, p_tempo_minutos integer,
  p_premissa_mensal text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid(); v_lote pcm.sso_levantamentos%rowtype;
  v_comando pcm.sso_levantamento_comandos%rowtype; v_cliente_alvo uuid;
  v_payload jsonb; v_resultado jsonb; v_id uuid;
begin
  if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then
    raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_lote_id is null or p_expected_revision is null
    or p_expected_revision < 1 or p_numero_linha is null or p_numero_linha < 1
    or p_disciplina is null or length(btrim(p_disciplina)) not between 1 and 200
    or p_nome_rotina is null or length(btrim(p_nome_rotina)) not between 1 and 200
    or p_alvo_tipo is null or p_alvo_tipo not in ('sistema','componente','grupo') or p_alvo_id is null
    or p_modo is null or p_modo not in ('calendario','visita')
    or p_intervalo is null or p_intervalo not between 1 and 1000
    or p_unidade is null or p_unidade not in ('dias','semanas','meses','anos')
    or (p_modo = 'calendario' and p_data_base is null)
    or (p_data_base is not null and not isfinite(p_data_base))
    or (p_tempo_minutos is not null and p_tempo_minutos <= 0)
    or p_premissa_mensal is null or p_premissa_mensal not in ('nao_aplicavel','calendario_real','quatro_semanas') then
    raise exception 'mapeamento_invalido' using errcode='22023'; end if;
  if p_premissa_mensal = 'quatro_semanas' and (p_intervalo <> 4 or p_unidade <> 'semanas') then
    raise exception 'premissa_incompativel' using errcode='22023'; end if;
  if p_premissa_mensal = 'calendario_real' and p_unidade <> 'meses' then
    raise exception 'premissa_incompativel' using errcode='22023'; end if;
  v_payload := jsonb_build_object('tipo','mapearCronograma','loteId',p_lote_id,
    'expectedRevision',p_expected_revision,'numeroLinha',p_numero_linha,
    'disciplina',btrim(p_disciplina),'nomeRotina',btrim(p_nome_rotina),'alvoTipo',p_alvo_tipo,
    'alvoId',p_alvo_id,'modo',p_modo,'intervalo',p_intervalo,'unidade',p_unidade,
    'dataBase',p_data_base,'tempoMinutos',p_tempo_minutos,'premissaMensal',p_premissa_mensal);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into v_comando from pcm.sso_levantamento_comandos where request_id=p_request_id;
  select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.origem='planilha'
    and l.chave_origem like 'cronograma:%' for update;
  if not found or config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then
    raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  if v_comando.request_id is not null then
    if v_comando.ator_id is distinct from v_ator or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  if v_lote.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if not exists(select 1 from pcm.sso_levantamento_linhas where lote_id=p_lote_id
    and chave=p_numero_linha::text and tipo='cronograma') then
    raise exception 'linha_inexistente' using errcode='23514'; end if;
  if p_alvo_tipo='sistema' then
    select cliente_id into v_cliente_alvo from pcm.sistemas where id=p_alvo_id and ativo and deleted_at is null for share;
  elsif p_alvo_tipo='componente' then
    select client_id into v_cliente_alvo from pcm.equipamentos where id=p_alvo_id and ativo and deleted_at is null for share;
  else
    select cliente_id into v_cliente_alvo from pcm.grupos_quantitativos where id=p_alvo_id and ativo and deleted_at is null for share;
  end if;
  if v_cliente_alvo is distinct from v_lote.cliente_id then
    raise exception 'alvo_invalido_ou_de_outro_cliente' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',v_lote.cliente_id) is distinct from true then
    raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  update pcm.sso_levantamentos set revisao=revisao+1 where id=p_lote_id returning * into v_lote;
  insert into pcm.sso_cronograma_mapeamentos(lote_id,chave_linha,revisao_lote,disciplina,nome_rotina,
    alvo_tipo,alvo_id,modo,intervalo_n,intervalo_unidade,data_base,tempo_minutos,premissa_mensal_quatro_semanas,ator_id)
    values(p_lote_id,p_numero_linha::text,v_lote.revisao,btrim(p_disciplina),btrim(p_nome_rotina),
      p_alvo_tipo,p_alvo_id,p_modo,p_intervalo,p_unidade,p_data_base,p_tempo_minutos,p_premissa_mensal,v_ator)
    returning id into v_id;
  v_resultado := jsonb_build_object('aggregateId',p_lote_id,'revision',v_lote.revisao,
    'state','pendente','mapeamentoId',v_id,'requestId',p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload)
    values(v_ator,'cronograma.linha_mapeada','sso_levantamentos',p_lote_id,
      jsonb_build_object('requestId',p_request_id,'linha',p_numero_linha,'revision',v_lote.revisao,'mapeamentoId',v_id));
  insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado)
    values(p_request_id,v_ator,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_mapear_linha_cronograma(uuid,uuid,integer,integer,text,text,text,uuid,text,integer,text,date,integer,text)
  from public,anon,authenticated,service_role;

create function pcm.sso_listar_mapeamentos_cronograma(p_cliente_id uuid,p_lote_id uuid,p_apos text,p_limite integer)
returns setof pcm.sso_cronograma_mapeamentos language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then
    raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id
      and origem='planilha' and chave_origem like 'cronograma:%') then
    raise exception 'lote_sem_acesso' using errcode='42501'; end if;
  return query select m.* from pcm.sso_cronograma_mapeamentos m
    where m.lote_id=p_lote_id and (p_apos is null or m.chave_linha > p_apos)
    and not exists(select 1 from pcm.sso_cronograma_mapeamentos posterior
      where posterior.lote_id=m.lote_id and posterior.chave_linha=m.chave_linha and posterior.revisao_lote>m.revisao_lote)
    order by m.chave_linha limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_mapeamentos_cronograma(uuid,uuid,text,integer) from public,anon,authenticated,service_role;
