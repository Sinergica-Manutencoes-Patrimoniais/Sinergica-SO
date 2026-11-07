-- ADR-0238: vigências separadas, com histórico e preservação do vínculo.
create table pcm.rotina_serie_vigencias (
  id uuid primary key,plano_id uuid not null references pcm.planos_manutencao(id),rotina_logica_id uuid not null,serie_id uuid not null,
  inicio date not null check(isfinite(inicio)),fim date check(fim is null or (isfinite(fim) and fim>=inicio)),
  revisao integer not null default 1 check(revisao>0),criado_por uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  foreign key(rotina_logica_id,serie_id) references pcm.rotina_visita_serie_vinculos(rotina_logica_id,serie_id)
);
create table pcm.rotina_serie_vigencia_eventos (
  id uuid primary key default gen_random_uuid(),vigencia_id uuid not null references pcm.rotina_serie_vigencias(id),
  revisao integer not null,acao text not null check(acao in ('criar','encerrar')),motivo text not null,
  request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(vigencia_id,revisao)
);
alter table pcm.rotina_serie_vigencias enable row level security;
alter table pcm.rotina_serie_vigencias force row level security;
alter table pcm.rotina_serie_vigencia_eventos enable row level security;
alter table pcm.rotina_serie_vigencia_eventos force row level security;
revoke all on pcm.rotina_serie_vigencias,pcm.rotina_serie_vigencia_eventos from public,anon,authenticated,service_role;
create function pcm.sso_proteger_evento_vigencia_rotina_serie() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'evento_vigencia_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_evento_vigencia_rotina_serie() from public,anon,authenticated,service_role;
create trigger rotina_serie_evento_imutavel before update or delete on pcm.rotina_serie_vigencia_eventos
  for each row execute function pcm.sso_proteger_evento_vigencia_rotina_serie();

create function pcm.sso_decidir_vigencia_rotina_serie(p_request_id uuid,p_plano_id uuid,p_rotina_id uuid,p_serie_id uuid,
  p_vigencia_id uuid,p_expected_revision integer,p_acao text,p_data date,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' set timezone='America/Sao_Paulo' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;
  v_vigencia pcm.rotina_serie_vigencias%rowtype;v_comando pcm.calendario_contratual_comandos%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_plano_id is null or p_rotina_id is null or p_serie_id is null or p_vigencia_id is null
    or p_expected_revision is null or p_expected_revision<0 or p_acao is null or p_acao not in ('criar','encerrar')
    or p_data is null or not isfinite(p_data) or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000
    or (p_acao='criar' and p_expected_revision<>0) or (p_acao='encerrar' and p_expected_revision<1) then raise exception 'vigencia_invalida' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('tipo','decidirVigenciaRotinaSerie','planoId',p_plano_id,'rotinaId',p_rotina_id,'serieId',p_serie_id,
    'vigenciaId',p_vigencia_id,'expectedRevision',p_expected_revision,'acao',p_acao,'data',p_data,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
  select * into v_comando from pcm.calendario_contratual_comandos where request_id=p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or config.sso_autorizar_acao('plano.gerir',v_comando.cliente_id) is distinct from true
      or config.sso_autorizar_acao('visita.confirmar',v_comando.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_comando.resultado;
  end if;
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_rotina from pcm.rotinas_manutencao where id=p_rotina_id and plano_id=p_plano_id;
  if not found then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
  perform 1 from pcm.rotina_visita_serie_vinculos where rotina_logica_id=v_rotina.rotina_logica_id and serie_id=p_serie_id and plano_id=p_plano_id for update;
  if not found then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  if p_data<current_date then raise exception 'vigencia_retroativa_nao_permitida' using errcode='23514'; end if;
  if p_acao='criar' then
    if exists(select 1 from pcm.rotina_serie_vigencias v where v.rotina_logica_id=v_rotina.rotina_logica_id and v.serie_id=p_serie_id
      and daterange(v.inicio,v.fim,'[]') && daterange(p_data,null,'[]')) then raise exception 'vigencia_sobreposta' using errcode='23514'; end if;
    insert into pcm.rotina_serie_vigencias(id,plano_id,rotina_logica_id,serie_id,inicio,criado_por)
      values(p_vigencia_id,p_plano_id,v_rotina.rotina_logica_id,p_serie_id,p_data,v_actor) returning * into v_vigencia;
  else
    select * into v_vigencia from pcm.rotina_serie_vigencias where id=p_vigencia_id and plano_id=p_plano_id
      and rotina_logica_id=v_rotina.rotina_logica_id and serie_id=p_serie_id for update;
    if not found or v_vigencia.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
    if v_vigencia.fim is not null or p_data<v_vigencia.inicio or exists(select 1 from pcm.ocorrencias_visita_preparadas o
      where o.plano_id=p_plano_id and o.rotina_logica_id=v_rotina.rotina_logica_id and o.serie_id=p_serie_id and o.vencimento_original>p_data) then
      raise exception 'vigencia_exige_reconciliacao' using errcode='23514'; end if;
    update pcm.rotina_serie_vigencias set fim=p_data,revisao=revisao+1 where id=p_vigencia_id returning * into v_vigencia;
  end if;
  if config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.rotina_serie_vigencia_eventos(vigencia_id,revisao,acao,motivo,request_id,ator_id) values(p_vigencia_id,v_vigencia.revisao,p_acao,btrim(p_motivo),p_request_id,v_actor);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'vigenciaId',p_vigencia_id,'revision',v_vigencia.revisao,'inicio',v_vigencia.inicio,'fim',v_vigencia.fim);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.vigencia_rotina_serie_'||p_acao,'planos_manutencao',p_plano_id,v_resultado);
  insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,v_plano.cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_decidir_vigencia_rotina_serie(uuid,uuid,uuid,uuid,uuid,integer,text,date,text) from public,anon,authenticated,service_role;

create function pcm.sso_proteger_vigencia_ocorrencia_visita() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from pcm.rotina_visita_serie_vinculos where plano_id=new.plano_id and rotina_logica_id=new.rotina_logica_id and serie_id=new.serie_id for update;
  if not found or not exists(select 1 from pcm.rotina_serie_vigencias v where v.plano_id=new.plano_id and v.rotina_logica_id=new.rotina_logica_id
    and v.serie_id=new.serie_id and v.inicio<=new.vencimento_original and (v.fim is null or v.fim>=new.vencimento_original)) then
    raise exception 'vigencia_nao_comprovada' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_proteger_vigencia_ocorrencia_visita() from public,anon,authenticated,service_role;
create trigger sso_ocorrencia_visita_vigencia before insert on pcm.ocorrencias_visita_preparadas
  for each row execute function pcm.sso_proteger_vigencia_ocorrencia_visita();
