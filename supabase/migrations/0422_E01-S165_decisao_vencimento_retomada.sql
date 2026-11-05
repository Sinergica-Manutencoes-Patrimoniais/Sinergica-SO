-- ADR-0196: decisão preliminar auditada, sem gerar ou cancelar ocorrência.
create table pcm.plano_vencimento_decisoes (
  id uuid primary key,plano_id uuid not null references pcm.planos_manutencao(id),
  versao_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null references pcm.rotinas_manutencao(id),
  revisao_plano integer not null check(revisao_plano>0),
  ciclo integer not null check(ciclo>=0),vencimento date not null,decisao text not null check(decisao in ('avaliar','tratar_manualmente')),
  motivo text not null check(length(btrim(motivo)) between 1 and 2000),request_id uuid not null unique,
  ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
create index plano_vencimento_decisoes_indice on pcm.plano_vencimento_decisoes(plano_id,rotina_id,vencimento,criado_em,id);
alter table pcm.plano_vencimento_decisoes enable row level security;
alter table pcm.plano_vencimento_decisoes force row level security;
revoke all on pcm.plano_vencimento_decisoes from public,anon,authenticated,service_role;
create function pcm.sso_proteger_decisao_vencimento() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'decisao_vencimento_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_decisao_vencimento() from public,anon,authenticated,service_role;
create trigger plano_vencimento_decisao_imutavel before update or delete on pcm.plano_vencimento_decisoes
  for each row execute function pcm.sso_proteger_decisao_vencimento();

create function pcm.sso_registrar_decisao_vencimento(p_request_id uuid,p_decisao_id uuid,p_plano_id uuid,p_expected_revision integer,
  p_versao_id uuid,p_rotina_id uuid,p_ciclo integer,p_vencimento date,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' set timezone='America/Sao_Paulo' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_anterior pcm.plano_vencimento_decisoes%rowtype;
  v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.plano_transicao_gate where id),false) then raise exception 'transicao_plano_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_decisao_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<1
    or p_versao_id is null or p_rotina_id is null or p_ciclo is null or p_ciclo<0 or p_vencimento is null or not isfinite(p_vencimento)
    or p_decisao is null or p_decisao not in ('avaliar','tratar_manualmente') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'decisao_invalida' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plano-vencimento:'||p_request_id::text,0));
  select * into v_anterior from pcm.plano_vencimento_decisoes where request_id=p_request_id;
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if v_anterior.request_id is not null then
    if v_anterior.ator_id is distinct from v_actor or v_anterior.id is distinct from p_decisao_id or v_anterior.plano_id is distinct from p_plano_id
      or v_anterior.revisao_plano is distinct from p_expected_revision or v_anterior.versao_id is distinct from p_versao_id or v_anterior.rotina_id is distinct from p_rotina_id or v_anterior.ciclo is distinct from p_ciclo
      or v_anterior.vencimento is distinct from p_vencimento or v_anterior.decisao is distinct from p_decisao or v_anterior.motivo is distinct from btrim(p_motivo) then
      raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'decisaoId',p_decisao_id,'efeitoOperacional',false);
  end if;
  if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if p_vencimento>=current_date or not exists(select 1 from pcm.plano_transicoes_historico h where h.plano_id=p_plano_id and h.acao='retomar')
    or not exists(select 1 from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_vencimento) ciclo
      where ciclo.ciclo=p_ciclo and ciclo.vencimento=p_vencimento) then raise exception 'candidato_nao_comprovado' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  insert into pcm.plano_vencimento_decisoes(id,plano_id,versao_id,rotina_id,revisao_plano,ciclo,vencimento,decisao,motivo,request_id,ator_id)
    values(p_decisao_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,p_ciclo,p_vencimento,p_decisao,btrim(p_motivo),p_request_id,v_actor);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'decisaoId',p_decisao_id,'efeitoOperacional',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.vencimento_decisao_preliminar','planos_manutencao',p_plano_id,
    jsonb_build_object('requestId',p_request_id,'decisaoId',p_decisao_id,'rotinaId',p_rotina_id,'vencimento',p_vencimento,'decisao',p_decisao));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_registrar_decisao_vencimento(uuid,uuid,uuid,integer,uuid,uuid,integer,date,text,text) from public,anon,authenticated,service_role;
