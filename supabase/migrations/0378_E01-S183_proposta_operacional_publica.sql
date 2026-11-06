-- ADR-0152: adaptador de decisão versionada; sem grant de aplicação.
create table comercial.sso_portal_proposta_comandos (
  request_id uuid primary key, ator_id uuid not null references config.usuarios(user_id),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table comercial.sso_portal_proposta_comandos enable row level security;
alter table comercial.sso_portal_proposta_comandos force row level security;
revoke all on comercial.sso_portal_proposta_comandos from public, anon, authenticated, service_role;

create function comercial.sso_portal_propostas_os(p_cliente_id uuid, p_os_id uuid, p_apos uuid default null)
returns table(id uuid, ordem_servico_id uuid, status text, versao integer, valido_ate date, payload jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_os_id is null or not exists (
    select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = p_cliente_id and u.ativo and u.papel = 'cliente-sindico'
  ) or not exists (select 1 from pcm.ordens_servico os where os.id = p_os_id and os.client_id = p_cliente_id and os.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return query select p.id, origem.ordem_servico_id, p.status, p.versao_atual, p.valido_ate,
    comercial.projecao_proposta_publica(v.payload)
    from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id = origem.proposta_id and p.deleted_at is null
    join comercial.oportunidades o on o.id = p.oportunidade_id and o.cliente_id = p_cliente_id and o.deleted_at is null
    join comercial.proposta_versoes v on v.proposta_id = p.id and v.versao = p.versao_atual
    where origem.ordem_servico_id = p_os_id and p.status in ('enviada', 'aceita', 'recusada')
      and (p_apos is null or p.id > p_apos) order by p.id limit 20;
end;
$$;
revoke all on function comercial.sso_portal_propostas_os(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create function comercial.sso_portal_decidir_proposta_versionada(p_request_id uuid, p_proposta_id uuid,
  p_versao integer, p_decisao text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_proposta comercial.propostas%rowtype; v_cliente uuid; v_payload jsonb; v_resultado jsonb;
  v_comando comercial.sso_portal_proposta_comandos%rowtype; v_status jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_proposta_id is null or p_versao is null or p_versao < 1
    or p_decisao is null or p_decisao not in ('aceita', 'recusada') or length(coalesce(p_motivo, '')) > 2000
    or (p_decisao = 'recusada' and nullif(btrim(p_motivo), '') is null) then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-proposta:' || p_request_id::text, 0));
  select * into v_proposta from comercial.propostas where id = p_proposta_id and deleted_at is null for update;
  if not found then raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select o.cliente_id into v_cliente from comercial.oportunidades o
    where o.id = v_proposta.oportunidade_id and o.deleted_at is null;
  if v_cliente is null or auth.jwt()->>'user_role' is distinct from 'cliente-sindico'
    or auth.jwt()->>'cliente_id' is distinct from v_cliente::text or not exists (
      select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
      where uc.user_id = auth.uid() and uc.cliente_id = v_cliente and u.ativo and u.papel = 'cliente-sindico')
    or not exists (select 1 from comercial.proposta_origens_operacionais origem
      join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.client_id = v_cliente and os.deleted_at is null
      where origem.proposta_id = p_proposta_id) then
    raise exception 'proposta_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('propostaId', p_proposta_id, 'versao', p_versao,
    'decisao', p_decisao, 'motivo', nullif(btrim(p_motivo), ''));
  select * into v_comando from comercial.sso_portal_proposta_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from auth.uid() or v_comando.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if v_proposta.versao_atual <> p_versao then raise exception 'versao_obsoleta' using errcode = '40001'; end if;
  if v_proposta.status <> 'enviada' then raise exception 'decisao_ja_registrada' using errcode = '23505'; end if;
  if v_proposta.valido_ate is not null and v_proposta.valido_ate < current_date then
    raise exception 'proposta_expirada' using errcode = '23514'; end if;
  if not exists (select 1 from comercial.proposta_versoes v where v.proposta_id = p_proposta_id and v.versao = p_versao) then
    raise exception 'versao_nao_encontrada' using errcode = '23514'; end if;
  v_status := comercial.portal_decidir_proposta(p_proposta_id, p_decisao, nullif(btrim(p_motivo), ''));
  if v_status->>'status' is distinct from p_decisao then raise exception 'decisao_nao_confirmada' using errcode = '23514'; end if;
  v_resultado := jsonb_build_object('aggregateId', p_proposta_id, 'revision', p_versao,
    'state', p_decisao, 'requestId', p_request_id);
  insert into comercial.sso_portal_proposta_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'proposta.decisao_portal_versionada', 'propostas', p_proposta_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'version', p_versao, 'decisao', p_decisao));
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_portal_decidir_proposta_versionada(uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;
