-- ADR-0163: transição fechada; não habilitar antes de adaptar todos os consumidores.
create table comercial.sso_origem_operacional_gate (id boolean primary key default true check (id), habilitado boolean not null default false);
alter table comercial.sso_origem_operacional_gate enable row level security;
alter table comercial.sso_origem_operacional_gate force row level security;
revoke all on comercial.sso_origem_operacional_gate from public, anon, authenticated, service_role;
insert into comercial.sso_origem_operacional_gate(id, habilitado) values (true, false);

alter table comercial.propostas alter column oportunidade_id drop not null;

create function comercial.sso_proteger_origem_operacional() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.oportunidade_id is null and not coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false) then
    raise exception 'origem_operacional_indisponivel' using errcode = '55000'; end if;
  return new;
end;
$$;
revoke all on function comercial.sso_proteger_origem_operacional() from public, anon, authenticated, service_role;
create trigger s181_origem_operacional_gate before insert or update of oportunidade_id on comercial.propostas
  for each row execute function comercial.sso_proteger_origem_operacional();

create function comercial.sso_checar_origem_operacional() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if tg_table_name = 'propostas' then v_id := new.id;
  else v_id := old.proposta_id; end if;
  if exists (select 1 from comercial.propostas p where p.id = v_id and p.oportunidade_id is null)
    and not exists (select 1 from comercial.proposta_origens_operacionais origem
      join pcm.listas_materiais l on l.id = origem.lista_materiais_id
      join pcm.ordens_servico os on os.id = origem.ordem_servico_id and os.id = l.ordem_servico_id
        and os.client_id = l.cliente_id
      where origem.proposta_id = v_id) then
    raise exception 'origem_operacional_ausente_ou_invalida' using errcode = '23514'; end if;
  return null;
end;
$$;
revoke all on function comercial.sso_checar_origem_operacional() from public, anon, authenticated, service_role;
create constraint trigger s181_proposta_tem_origem after insert or update of oportunidade_id on comercial.propostas
  deferrable initially deferred for each row execute function comercial.sso_checar_origem_operacional();
create constraint trigger s181_preservar_origem after delete or update on comercial.proposta_origens_operacionais
  deferrable initially deferred for each row execute function comercial.sso_checar_origem_operacional();

create function comercial.sso_criar_orcamento_sem_oportunidade(p_request_id uuid, p_lista_id uuid,
  p_lista_revision integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_lista pcm.listas_materiais%rowtype; v_proposta comercial.propostas%rowtype;
  v_anterior comercial.sso_orcamento_operacional_comandos%rowtype; v_payload jsonb; v_resultado jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_lista_id is null or p_lista_revision is null or p_lista_revision < 1 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('orcamento-operacional:' || p_request_id::text, 0));
  select * into v_lista from pcm.listas_materiais where id = p_lista_id for update;
  if not found or v_lista.responsavel <> 'sinergica'
    or config.sso_autorizar_acao('orcamento.emitir', v_lista.cliente_id) is not true
    or config.sso_autorizar_acao('custo.ler', v_lista.cliente_id) is not true
    or config.sso_autorizar_acao('material.gerir', v_lista.cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico os where os.id = v_lista.ordem_servico_id
      and os.client_id = v_lista.cliente_id and os.deleted_at is null) then
    raise exception 'origem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  perform comercial._fn_guarda_comercial_escrita();
  v_payload := jsonb_build_object('operacao', 'criar_sem_oportunidade', 'listaId', p_lista_id, 'listaRevision', p_lista_revision);
  select * into v_anterior from comercial.sso_orcamento_operacional_comandos where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from auth.uid() or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_anterior.resultado;
  end if;
  if not coalesce((select g.habilitado from comercial.sso_origem_operacional_gate g where g.id), false) then
    raise exception 'origem_operacional_indisponivel' using errcode = '55000'; end if;
  if v_lista.revisao <> p_lista_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if exists (select 1 from comercial.proposta_origens_operacionais origem
    join comercial.propostas p on p.id = origem.proposta_id and p.deleted_at is null and p.status <> 'cancelada'
    where origem.lista_materiais_id = p_lista_id) then raise exception 'proposta_ativa_existente' using errcode = '23505'; end if;
  insert into comercial.propostas(oportunidade_id, tipo, created_by)
    values (null, 'simples', auth.uid()) returning * into v_proposta;
  insert into comercial.proposta_versoes(proposta_id, versao, payload, criado_por)
    values (v_proposta.id, v_proposta.versao_atual, to_jsonb(v_proposta), auth.uid());
  insert into comercial.proposta_origens_operacionais(proposta_id, ordem_servico_id, lista_materiais_id, criado_por)
    values (v_proposta.id, v_lista.ordem_servico_id, p_lista_id, auth.uid());
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (auth.uid(), 'orcamento_operacional.criado', 'propostas', v_proposta.id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_lista.cliente_id,
        'listaId', p_lista_id, 'osId', v_lista.ordem_servico_id, 'revision', v_proposta.versao_atual));
  v_resultado := jsonb_build_object('aggregateId', v_proposta.id, 'revision', v_proposta.versao_atual,
    'state', v_proposta.status, 'created', true, 'linkedIds', jsonb_build_object('listaId', p_lista_id,
      'ordemServicoId', v_lista.ordem_servico_id), 'warnings', '[]'::jsonb, 'requestId', p_request_id);
  insert into comercial.sso_orcamento_operacional_comandos(request_id, ator_id, payload, resultado)
    values (p_request_id, auth.uid(), v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function comercial.sso_criar_orcamento_sem_oportunidade(uuid, uuid, integer)
  from public, anon, authenticated, service_role;

-- A origem operacional fornece Cliente quando não há oportunidade; origem comercial
-- continua obrigada a concordar com a lista. Contrato e grants anteriores preservados.
create or replace function comercial.sso_listar_orcamentos_os(p_cliente_id uuid, p_ordem_servico_id uuid,
  p_limite integer, p_apos uuid default null)
returns table(id uuid, status text, versao integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_ordem_servico_id is null or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if config.sso_autorizar_acao('material.gerir', p_cliente_id) is not true
    or config.sso_autorizar_acao('custo.ler', p_cliente_id) is not true
    or not exists (select 1 from pcm.ordens_servico o where o.id = p_ordem_servico_id
      and o.client_id = p_cliente_id and o.deleted_at is null) then
    raise exception 'ordem_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  if exists (select 1 from comercial.proposta_origens_operacionais v
    left join comercial.propostas p on p.id = v.proposta_id and p.deleted_at is null
    left join comercial.oportunidades op on op.id = p.oportunidade_id and op.deleted_at is null
    left join pcm.listas_materiais l on l.id = v.lista_materiais_id
    where v.ordem_servico_id = p_ordem_servico_id and
      (p.id is null or l.cliente_id is distinct from p_cliente_id or l.ordem_servico_id is distinct from p_ordem_servico_id
        or (p.oportunidade_id is not null and op.cliente_id is distinct from p_cliente_id))) then
    raise exception 'origem_inconsistente' using errcode = '23514'; end if;
  return query select p.id, p.status, p.versao_atual from comercial.proposta_origens_operacionais v
    join comercial.propostas p on p.id = v.proposta_id where v.ordem_servico_id = p_ordem_servico_id
      and (p_apos is null or p.id > p_apos) order by p.id limit p_limite;
end;
$$;
