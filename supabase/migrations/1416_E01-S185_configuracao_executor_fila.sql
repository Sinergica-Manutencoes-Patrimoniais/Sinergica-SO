-- ADR-1264: configuração preparada; gate fechado e nenhum cron criado.
alter table pcm.sso_executor_varredura_fila add column if not exists configuracao_revisao integer not null default 1 check(configuracao_revisao > 0);
create table pcm.sso_config_executor_fila_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_config_executor_fila_gate(id, habilitado) values(true, false);
create table pcm.sso_config_executor_fila_comandos(request_id uuid primary key, ator_id uuid not null references auth.users(id), payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now());
alter table pcm.sso_config_executor_fila_gate enable row level security;
alter table pcm.sso_config_executor_fila_gate force row level security;
alter table pcm.sso_config_executor_fila_comandos enable row level security;
alter table pcm.sso_config_executor_fila_comandos force row level security;
revoke all on pcm.sso_config_executor_fila_gate, pcm.sso_config_executor_fila_comandos from public, anon, authenticated, service_role;
create trigger sso_config_executor_fila_comandos_imutaveis before update or delete on pcm.sso_config_executor_fila_comandos for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_configurar_executor_fila(p_ator_id uuid, p_request_id uuid, p_revisao integer, p_habilitado boolean, p_intervalo integer, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_config pcm.sso_executor_varredura_fila%rowtype; v_cmd pcm.sso_config_executor_fila_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() or p_request_id is null or p_revisao is null or p_revisao < 1
    or p_habilitado is null or p_intervalo is null or p_intervalo not between 5 and 10080 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_config_executor_fila_gate where id and habilitado for share;
  if not found then raise exception 'configuracao_desabilitada' using errcode = '55000'; end if;
  if coalesce(auth.jwt()->>'user_role','') <> 'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('revisao',p_revisao,'habilitado',p_habilitado,'intervalo',p_intervalo,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-config-executor-fila:'||p_request_id::text,0));
  select * into v_cmd from pcm.sso_config_executor_fila_comandos where request_id=p_request_id;
  if found then
    if v_cmd.ator_id is distinct from p_ator_id or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_cmd.resultado;
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-executor-varredura-periodica',0)) then raise exception 'executor_em_andamento' using errcode = '55P03'; end if;
  select * into v_config from pcm.sso_executor_varredura_fila where id for update;
  if not found or v_config.configuracao_revisao <> p_revisao then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if v_config.habilitado is not distinct from p_habilitado and v_config.intervalo_minutos = p_intervalo then raise exception 'sem_alteracao' using errcode = '22023'; end if;
  update pcm.sso_executor_varredura_fila set habilitado=p_habilitado, intervalo_minutos=p_intervalo, configuracao_revisao=configuracao_revisao+1, atualizado_em=now() where id returning * into v_config;
  v_resultado := jsonb_build_object('requestId',p_request_id,'revisao',v_config.configuracao_revisao,'habilitado',v_config.habilitado,'intervaloMinutos',v_config.intervalo_minutos,'cronCriado',false,'efeitoRemotoComprovado',false);
  insert into pcm.sso_config_executor_fila_comandos(request_id,ator_id,payload,resultado) values(p_request_id,p_ator_id,v_payload,v_resultado);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'integracao.configuracao_executor_alterada','sso_executor_varredura_fila',null,v_payload || v_resultado);
  return v_resultado;
end $$;
revoke all on function pcm.sso_configurar_executor_fila(uuid,uuid,integer,boolean,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_configurar_executor_fila(uuid,uuid,integer,boolean,integer,text) to authenticated;

create function pcm.sso_consultar_config_executor_fila(p_ator_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_config pcm.sso_executor_varredura_fila%rowtype;
begin
  if current_setting('transaction_isolation') <> 'read committed' or auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_config_executor_fila_gate where id and habilitado for share;
  if not found then raise exception 'configuracao_desabilitada' using errcode = '55000'; end if;
  if coalesce(auth.jwt()->>'user_role','') <> 'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode = '42501'; end if;
  select * into v_config from pcm.sso_executor_varredura_fila where id for share;
  if not found then raise exception 'configuracao_indisponivel' using errcode = '55000'; end if;
  return jsonb_build_object('revisao',v_config.configuracao_revisao,'habilitado',v_config.habilitado,'intervaloMinutos',v_config.intervalo_minutos);
end $$;
revoke all on function pcm.sso_consultar_config_executor_fila(uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_config_executor_fila(uuid) to authenticated;

create function pcm.sso_historico_config_executor_fila(p_ator_id uuid, p_antes timestamptz, p_antes_request uuid, p_limite integer)
returns table(request_id uuid, ator_id uuid, revisao integer, habilitado boolean, intervalo_minutos integer, motivo text, criado_em timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' or auth.uid() is null or auth.uid() is distinct from p_ator_id
    or p_limite is null or p_limite not between 1 and 100 or (p_antes is null) <> (p_antes_request is null) then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_config_executor_fila_gate where id and habilitado for share;
  if not found then raise exception 'configuracao_desabilitada' using errcode = '55000'; end if;
  if coalesce(auth.jwt()->>'user_role','') <> 'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode = '42501'; end if;
  return query select c.request_id,c.ator_id,(c.resultado->>'revisao')::integer,(c.resultado->>'habilitado')::boolean,
    (c.resultado->>'intervaloMinutos')::integer,c.payload->>'motivo',c.criado_em from pcm.sso_config_executor_fila_comandos c
    where p_antes is null or (c.criado_em,c.request_id) < (p_antes,p_antes_request)
    order by c.criado_em desc,c.request_id desc limit p_limite;
end $$;
revoke all on function pcm.sso_historico_config_executor_fila(uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_historico_config_executor_fila(uuid,timestamptz,uuid,integer) to authenticated;

create function pcm.sso_recibo_config_executor_fila(p_ator_id uuid, p_request_id uuid, p_revisao integer, p_habilitado boolean, p_intervalo integer, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_cmd pcm.sso_config_executor_fila_comandos%rowtype; v_payload jsonb;
begin
  if current_setting('transaction_isolation') <> 'read committed' or auth.uid() is null or auth.uid() is distinct from p_ator_id
    or p_request_id is null or p_revisao is null or p_revisao < 1 or p_habilitado is null or p_intervalo is null or p_intervalo not between 5 and 10080
    or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_config_executor_fila_gate where id and habilitado for share;
  if not found then raise exception 'configuracao_desabilitada' using errcode = '55000'; end if;
  if coalesce(auth.jwt()->>'user_role','') <> 'superadmin' or not exists(select 1 from config.usuarios u where u.user_id=p_ator_id and u.ativo and u.papel='superadmin') then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-config-executor-fila:'||p_request_id::text,0)) then raise exception 'pedido_em_andamento' using errcode = '55P03'; end if;
  select * into v_cmd from pcm.sso_config_executor_fila_comandos where request_id=p_request_id;
  if not found then return null; end if;
  v_payload := jsonb_build_object('revisao',p_revisao,'habilitado',p_habilitado,'intervalo',p_intervalo,'motivo',btrim(p_motivo));
  if v_cmd.ator_id is distinct from p_ator_id or v_cmd.payload is distinct from v_payload then raise exception 'recibo_indisponivel' using errcode = '42501'; end if;
  return v_cmd.resultado;
end $$;
revoke all on function pcm.sso_recibo_config_executor_fila(uuid,uuid,integer,boolean,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recibo_config_executor_fila(uuid,uuid,integer,boolean,integer,text) to authenticated;
