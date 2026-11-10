-- ADR-1233: preparação privada; não aprova prévia nem executa migração completa.
create table pcm.sso_lote_rascunhos_legados_gate (
  id boolean primary key default true check(id), habilitado boolean not null default false
);
insert into pcm.sso_lote_rascunhos_legados_gate(id,habilitado) values(true,false);
create table pcm.sso_lotes_rascunhos_legados (
  request_id uuid primary key, ator_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id), itens jsonb not null,
  resultado jsonb not null, criado_em timestamptz not null default now(),
  check(jsonb_typeof(itens)='array'), check(jsonb_typeof(resultado)='object')
);
alter table pcm.sso_lote_rascunhos_legados_gate enable row level security;
alter table pcm.sso_lote_rascunhos_legados_gate force row level security;
alter table pcm.sso_lotes_rascunhos_legados enable row level security;
alter table pcm.sso_lotes_rascunhos_legados force row level security;
revoke all on pcm.sso_lote_rascunhos_legados_gate,pcm.sso_lotes_rascunhos_legados from public,anon,authenticated,service_role;
create trigger sso_lotes_rascunhos_legados_imutaveis before update or delete on pcm.sso_lotes_rascunhos_legados
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_criar_lote_rascunhos_planos_legados(
  p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_itens jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_lotes_rascunhos_legados%rowtype; v_item jsonb;
  v_resultado_item jsonb; v_resultados jsonb:='[]'::jsonb; v_resultado jsonb;
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null
    or jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if jsonb_array_length(p_itens) not between 1 and 20 or octet_length(p_itens::text)>524288 then raise exception 'limite_excedido' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_itens) e where jsonb_typeof(e) is distinct from 'object'
    or (e-'requestId'-'planoId'-'rotinaId'-'fotografia'-'modo'-'intervalo'-'unidade'-'dataBase'-'antes'-'depois')<>'{}'::jsonb
    or coalesce(e->>'requestId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(e->>'planoId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or coalesce(e->>'rotinaId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(e->'fotografia') is distinct from 'object'
    or coalesce(e->>'modo','') not in ('calendario','visita')
    or coalesce(e->>'unidade','') not in ('dias','semanas','meses','anos')
    or coalesce(e->>'intervalo','') !~ '^[1-9][0-9]{0,4}$'
    or coalesce(e->>'antes','') !~ '^(0|[1-9][0-9]{0,4})$'
    or coalesce(e->>'depois','') !~ '^(0|[1-9][0-9]{0,4})$'
    or coalesce(e->>'dataBase','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
    raise exception 'item_invalido' using errcode='22023';
  end if;
  if (select count(distinct (e->>'requestId')::uuid) from jsonb_array_elements(p_itens) e)<>jsonb_array_length(p_itens)
    or (select count(distinct (e->>'planoId')::uuid) from jsonb_array_elements(p_itens) e)<>jsonb_array_length(p_itens)
    or (select count(distinct (e->>'rotinaId')::uuid) from jsonb_array_elements(p_itens) e)<>jsonb_array_length(p_itens)
    or exists(select 1 from jsonb_array_elements(p_itens) e where (e->>'requestId')::uuid=p_request_id) then
    raise exception 'identidade_duplicada' using errcode='23505';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_lote_rascunhos_legados_gate where id and habilitado for share;
  if not found then raise exception 'lote_desabilitado' using errcode='55000'; end if;
  perform 1 from pcm.sso_rascunho_plano_legado_gate where id and habilitado for share;
  if not found then raise exception 'migracao_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.migracao_preflight_gate where id and habilitado for share;
  if not found then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
  perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
  if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lote-rascunhos-legados:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_lotes_rascunhos_legados where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id or v_ant.itens is distinct from p_itens then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_ant.resultado;
  end if;
  if exists(select 1 from pcm.sso_rascunhos_planos_legados r join jsonb_array_elements(p_itens) e
    on r.request_id=(e->>'requestId')::uuid or r.plano_legado_id=(e->>'planoId')::uuid) then
    raise exception 'item_ja_processado_exige_reconciliacao' using errcode='23505';
  end if;
  for v_item in select e from jsonb_array_elements(p_itens) e order by (e->>'planoId')::uuid loop
    v_resultado_item:=pcm.sso_criar_rascunho_plano_legado(p_ator_id,p_cliente_id,(v_item->>'requestId')::uuid,
      (v_item->>'planoId')::uuid,(v_item->>'rotinaId')::uuid,v_item->'fotografia',v_item->>'modo',
      (v_item->>'intervalo')::integer,v_item->>'unidade',(v_item->>'dataBase')::date,
      (v_item->>'antes')::integer,(v_item->>'depois')::integer);
    v_resultados:=v_resultados||jsonb_build_array(v_resultado_item);
  end loop;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'quantidade',jsonb_array_length(p_itens),
    'itens',v_resultados,'equivalenciaComprovada',false,'aprovacaoRealizada',false);
  insert into pcm.sso_lotes_rascunhos_legados(request_id,ator_id,cliente_id,itens,resultado)
    values(p_request_id,p_ator_id,p_cliente_id,p_itens,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'migracao.lote_rascunhos_legados',
    'sso_lotes_rascunhos_legados',p_request_id,jsonb_build_object('clienteId',p_cliente_id,'quantidade',jsonb_array_length(p_itens)));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_criar_lote_rascunhos_planos_legados(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
