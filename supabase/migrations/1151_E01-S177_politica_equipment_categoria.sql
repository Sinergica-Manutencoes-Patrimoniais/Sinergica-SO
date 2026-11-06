-- ADR-0998: cadastro privado; não altera o dispatcher ou filas existentes.
create table pcm.sso_politica_equipment_gate (id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_politica_equipment_gate(id,habilitado) values(true,false);
create table pcm.sso_politica_equipment_categoria (
  categoria_id uuid primary key references pcm.equipamento_categorias(id),
  equipamento_controlado boolean not null,
  revisao integer not null check(revisao > 0),
  atualizado_por uuid not null references auth.users(id),
  atualizado_em timestamptz not null default now()
);
create table pcm.sso_politica_equipment_comandos (
  request_id uuid primary key, ator_id uuid not null references auth.users(id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_politica_equipment_gate enable row level security;
alter table pcm.sso_politica_equipment_gate force row level security;
alter table pcm.sso_politica_equipment_categoria enable row level security;
alter table pcm.sso_politica_equipment_categoria force row level security;
alter table pcm.sso_politica_equipment_comandos enable row level security;
alter table pcm.sso_politica_equipment_comandos force row level security;
revoke all on pcm.sso_politica_equipment_gate, pcm.sso_politica_equipment_categoria, pcm.sso_politica_equipment_comandos from public, anon, authenticated, service_role;

create function pcm.sso_configurar_politica_equipment(
  p_ator_id uuid, p_request_id uuid, p_categoria_id uuid, p_revisao integer, p_controlado boolean, p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_anterior pcm.sso_politica_equipment_categoria%rowtype; v_comando pcm.sso_politica_equipment_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_request_id is null or p_categoria_id is null or p_revisao is null or p_revisao < 0 or p_controlado is null or p_motivo is null or pg_catalog.length(pg_catalog.btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_politica_equipment_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'politica_equipment_desabilitada' using errcode='55000'; end if;
  if not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin' and auth.jwt()->>'user_role'='superadmin') then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload := pg_catalog.jsonb_build_object('categoriaId',p_categoria_id,'revision',p_revisao,'controlado',p_controlado,'motivo',pg_catalog.btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('politica-equipment-request:' || p_request_id::text,0));
  select * into v_comando from pcm.sso_politica_equipment_comandos where request_id=p_request_id;
  if found then
    if v_comando.ator_id is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('politica-equipment-categoria:' || p_categoria_id::text,0));
  perform 1 from pcm.equipamento_categorias c where c.id=p_categoria_id and c.deleted_at is null for share;
  if not found then raise exception 'categoria_indisponivel' using errcode='23514'; end if;
  select * into v_anterior from pcm.sso_politica_equipment_categoria where categoria_id=p_categoria_id for update;
  if coalesce(v_anterior.revisao,0) <> p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  insert into pcm.sso_politica_equipment_categoria(categoria_id,equipamento_controlado,revisao,atualizado_por)
    values(p_categoria_id,p_controlado,p_revisao+1,p_ator_id)
    on conflict(categoria_id) do update set equipamento_controlado=excluded.equipamento_controlado, revisao=excluded.revisao, atualizado_por=excluded.atualizado_por, atualizado_em=now();
  v_resultado := pg_catalog.jsonb_build_object('requestId',p_request_id,'categoriaId',p_categoria_id,'revision',p_revisao+1,'controlado',p_controlado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'codigo.politica_equipment_alterada','equipamento_categoria',p_categoria_id,v_resultado || pg_catalog.jsonb_build_object('anterior',v_anterior.equipamento_controlado,'motivo',pg_catalog.btrim(p_motivo)));
  insert into pcm.sso_politica_equipment_comandos(request_id,ator_id,payload,resultado) values(p_request_id,p_ator_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_configurar_politica_equipment(uuid,uuid,uuid,integer,boolean,text) from public,anon,authenticated,service_role;
