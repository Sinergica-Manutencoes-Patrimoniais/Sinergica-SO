-- ADR-0403: pesos globais existentes; comando privado e desligado.
create table pcm.sso_pesos_gutd_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_pesos_gutd_gate(id,habilitado) values(true,false);
create table pcm.sso_pesos_gutd_eventos(id uuid primary key default gen_random_uuid(),antes jsonb not null,depois jsonb not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now());
alter table pcm.sso_pesos_gutd_gate enable row level security;alter table pcm.sso_pesos_gutd_gate force row level security;
alter table pcm.sso_pesos_gutd_eventos enable row level security;alter table pcm.sso_pesos_gutd_eventos force row level security;
revoke all on pcm.sso_pesos_gutd_gate,pcm.sso_pesos_gutd_eventos from public,anon,authenticated,service_role;
create function pcm.sso_pesos_gutd_eventos_imutaveis() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function pcm.sso_pesos_gutd_eventos_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_pesos_gutd_eventos_imutaveis before update or delete on pcm.sso_pesos_gutd_eventos for each row execute function pcm.sso_pesos_gutd_eventos_imutaveis();
create function pcm.sso_atualizar_pesos_gutd(p_request_id uuid,p_antes jsonb,p_g integer,p_u integer,p_t integer,p_d integer,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_cfg config.priorizacao_gutd%rowtype;v_ant pcm.sso_pesos_gutd_eventos%rowtype;v_atual jsonb;v_depois jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_pesos_gutd_gate where id),false) then raise exception 'pesos_desabilitados' using errcode='55000'; end if;
  if v_ator is null or auth.jwt()->>'user_role' is distinct from 'superadmin' then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_request_id is null or jsonb_typeof(p_antes) is distinct from 'object' or p_g is null or p_u is null or p_t is null or p_d is null or p_g not between 0 and 100 or p_u not between 0 and 100 or p_t not between 0 and 100 or p_d not between 0 and 100 or p_g+p_u+p_t+p_d<>100 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_depois:=jsonb_build_object('g',p_g,'u',p_u,'t',p_t,'d',p_d);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pesos-gutd:'||p_request_id::text,0));
  select * into v_cfg from config.priorizacao_gutd where id=1 for update;
  if not found then raise exception 'configuracao_indisponivel' using errcode='23514'; end if;
  select * into v_ant from pcm.sso_pesos_gutd_eventos where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.antes is distinct from p_antes or v_ant.depois is distinct from v_depois or v_ant.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('pesos',v_ant.depois,'requestId',p_request_id);
  end if;
  v_atual:=jsonb_build_object('g',v_cfg.peso_gravidade,'u',v_cfg.peso_urgencia,'t',v_cfg.peso_tendencia,'d',v_cfg.peso_dor_cliente);
  if v_atual is distinct from p_antes then raise exception 'configuracao_obsoleta' using errcode='40001'; end if;
  if v_atual=v_depois then raise exception 'sem_alteracao' using errcode='23514'; end if;
  update config.priorizacao_gutd set peso_gravidade=p_g,peso_urgencia=p_u,peso_tendencia=p_t,peso_dor_cliente=p_d,updated_at=now(),updated_by=v_ator where id=1;
  insert into pcm.sso_pesos_gutd_eventos(antes,depois,motivo,ator_id,request_id) values(v_atual,v_depois,btrim(p_motivo),v_ator,p_request_id);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'backlog.pesos_gutd_alterados','priorizacao_gutd',null,jsonb_build_object('antes',v_atual,'depois',v_depois,'motivo',btrim(p_motivo),'requestId',p_request_id));
  return jsonb_build_object('pesos',v_depois,'requestId',p_request_id);
end;
$$;
revoke all on function pcm.sso_atualizar_pesos_gutd(uuid,jsonb,integer,integer,integer,integer,text) from public,anon,authenticated,service_role;
create function pcm.sso_historico_pesos_gutd(p_apos uuid,p_limite integer)
returns table(id uuid,antes jsonb,depois jsonb,motivo text,ator_id uuid,criado_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.sso_pesos_gutd_gate where id),false) then raise exception 'pesos_desabilitados' using errcode='55000'; end if;
  if auth.uid() is null or auth.jwt()->>'user_role' is distinct from 'superadmin' then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  return query select e.id,e.antes,e.depois,e.motivo,e.ator_id,e.criado_em from pcm.sso_pesos_gutd_eventos e where (p_apos is null or e.id>p_apos) order by e.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_historico_pesos_gutd(uuid,integer) from public,anon,authenticated,service_role;
