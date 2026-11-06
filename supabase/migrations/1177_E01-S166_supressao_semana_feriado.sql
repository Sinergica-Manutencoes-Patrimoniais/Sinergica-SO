-- ADR-1026: registro preparatório; nenhum envio ou geração.
create table pcm.sso_supressao_semana_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_supressao_semana_gate(id,habilitado) values(true,false);
create table pcm.sso_supressoes_semana_feriado (
  id uuid primary key default gen_random_uuid(),request_id uuid not null unique,cliente_id uuid not null references pcm.clientes(id),
  serie_id uuid not null references pcm.calendario_contratual_series(id),regra_id uuid not null references pcm.regras_visita_contratual(id),
  semana_origem date not null, data_contratual date not null,feriado_id uuid not null references pcm.feriados_declarados(id),
  feriado_revisao integer not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),
  check(pg_catalog.isfinite(semana_origem) and extract(isodow from semana_origem)=1)
);
create table pcm.sso_revogacoes_supressao_semana (
  supressao_id uuid primary key references pcm.sso_supressoes_semana_feriado(id),request_id uuid not null unique,
  ator_id uuid not null references auth.users(id),motivo text not null check(pg_catalog.length(pg_catalog.btrim(motivo)) between 1 and 2000),criado_em timestamptz not null default now()
);
alter table pcm.sso_supressao_semana_gate enable row level security;
alter table pcm.sso_supressao_semana_gate force row level security;
alter table pcm.sso_supressoes_semana_feriado enable row level security;
alter table pcm.sso_supressoes_semana_feriado force row level security;
alter table pcm.sso_revogacoes_supressao_semana enable row level security;
alter table pcm.sso_revogacoes_supressao_semana force row level security;
revoke all on pcm.sso_supressao_semana_gate,pcm.sso_supressoes_semana_feriado,pcm.sso_revogacoes_supressao_semana from public,anon,authenticated,service_role;
create function pcm.sso_proteger_supressao_semana() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'supressao_semana_imutavel' using errcode='23514'; end;
$$;
revoke all on function pcm.sso_proteger_supressao_semana() from public,anon,authenticated,service_role;
create trigger sso_supressao_semana_imutavel before update or delete on pcm.sso_supressoes_semana_feriado for each row execute function pcm.sso_proteger_supressao_semana();
create trigger sso_revogacao_semana_imutavel before update or delete on pcm.sso_revogacoes_supressao_semana for each row execute function pcm.sso_proteger_supressao_semana();

create function pcm.sso_guardar_origem_semana_suprimida() returns trigger language plpgsql security definer set search_path='' as $$
declare v_ativo boolean;
begin
  select g.habilitado into v_ativo from pcm.sso_supressao_semana_gate g where g.id for share;
  if v_ativo is distinct from true then return new; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-semana-visita:'||new.serie_id::text||':'||new.semana_origem::text,0)) then raise exception 'semana_em_alteracao' using errcode='55P03'; end if;
  if exists(select 1 from pcm.sso_supressoes_semana_feriado s where s.serie_id=new.serie_id and s.semana_origem=new.semana_origem and not exists(select 1 from pcm.sso_revogacoes_supressao_semana r where r.supressao_id=s.id)) then raise exception 'semana_suprimida_feriado' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_origem_semana_suprimida() from public,anon,authenticated,service_role;
create trigger sso_origem_semana_suprimida before insert on pcm.visita_origem_contratual for each row execute function pcm.sso_guardar_origem_semana_suprimida();

create function pcm.sso_registrar_supressao_semana(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_serie_id uuid,p_regra_id uuid,p_semana date,p_feriado_id uuid,p_feriado_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_serie pcm.calendario_contratual_series%rowtype;v_regra pcm.regras_visita_contratual%rowtype;v_f pcm.feriados_declarados%rowtype;v_anterior pcm.sso_supressoes_semana_feriado%rowtype;v_data date;v_id uuid;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null or p_request_id is null or p_serie_id is null or p_regra_id is null or p_feriado_id is null or p_feriado_revisao is null or p_feriado_revisao<1 or p_semana is null or not pg_catalog.isfinite(p_semana) or extract(isodow from p_semana)<>1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_supressao_semana_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'supressao_semana_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_coordenacao_feriados_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'coordenacao_feriados_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('supressao-semana-request:'||p_request_id::text,0)) then raise exception 'pedido_em_alteracao' using errcode='55P03'; end if;
  select * into v_anterior from pcm.sso_supressoes_semana_feriado where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from p_ator_id or v_anterior.cliente_id is distinct from p_cliente_id or v_anterior.serie_id is distinct from p_serie_id or v_anterior.regra_id is distinct from p_regra_id or v_anterior.semana_origem is distinct from p_semana or v_anterior.feriado_id is distinct from p_feriado_id or v_anterior.feriado_revisao is distinct from p_feriado_revisao then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return pg_catalog.jsonb_build_object('requestId',p_request_id,'supressaoId',v_anterior.id,'serieId',p_serie_id,'semanaOrigem',p_semana,'dataContratual',v_anterior.data_contratual,'visitaCriada',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-semana-visita:'||p_serie_id::text||':'||p_semana::text,0)) then raise exception 'semana_em_alteracao' using errcode='55P03'; end if;
  select * into v_serie from pcm.calendario_contratual_series where id=p_serie_id and cliente_id=p_cliente_id for share nowait;
  if not found then raise exception 'serie_indisponivel' using errcode='42501'; end if;
  select * into v_regra from pcm.regras_visita_contratual where id=p_regra_id and serie_id=p_serie_id for share nowait;
  if not found or p_semana<v_regra.ancora_semana or mod((p_semana-v_regra.ancora_semana)::bigint,7::bigint*v_regra.intervalo_semanas)<>0 then raise exception 'semana_incompativel' using errcode='23514'; end if;
  v_data:=p_semana+(v_regra.dia_semana-1);
  if v_data<v_regra.vigencia_inicio or (v_regra.vigencia_fim is not null and v_data>v_regra.vigencia_fim) then raise exception 'regra_fora_vigencia' using errcode='23514'; end if;
  select * into v_f from pcm.feriados_declarados where id=p_feriado_id and cliente_id=p_cliente_id and ativo and revisao=p_feriado_revisao and data=v_data and (contrato_id is null or contrato_id=v_serie.contrato_id);
  if not found then raise exception 'feriado_indisponivel_ou_alterado' using errcode='40001'; end if;
  if exists(select 1 from pcm.visita_origem_contratual o where o.serie_id=p_serie_id and o.semana_origem=p_semana) then raise exception 'visita_existente_exige_reconciliacao' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_geracao_visita_contratual g where g.serie_id=p_serie_id and g.semana=p_semana) then raise exception 'semana_ja_processada_ou_requer_reconciliacao' using errcode='23505'; end if;
  if exists(select 1 from pcm.sso_supressoes_semana_feriado s where s.serie_id=p_serie_id and s.semana_origem=p_semana and not exists(select 1 from pcm.sso_revogacoes_supressao_semana r where r.supressao_id=s.id)) then raise exception 'semana_ja_suprimida' using errcode='23505'; end if;
  insert into pcm.sso_supressoes_semana_feriado(request_id,cliente_id,serie_id,regra_id,semana_origem,data_contratual,feriado_id,feriado_revisao,ator_id) values(p_request_id,p_cliente_id,p_serie_id,p_regra_id,p_semana,v_data,p_feriado_id,p_feriado_revisao,p_ator_id) returning id into v_id;
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'calendario.semana_suprimida_feriado','calendario_contratual_series',p_serie_id,pg_catalog.jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'semanaOrigem',p_semana,'feriadoId',p_feriado_id,'supressaoId',v_id));
  return pg_catalog.jsonb_build_object('requestId',p_request_id,'supressaoId',v_id,'serieId',p_serie_id,'semanaOrigem',p_semana,'dataContratual',v_data,'visitaCriada',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
end;
$$;
revoke all on function pcm.sso_registrar_supressao_semana(uuid,uuid,uuid,uuid,uuid,date,uuid,integer) from public,anon,authenticated,service_role;
