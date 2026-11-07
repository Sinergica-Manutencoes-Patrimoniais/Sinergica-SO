-- ADR-0133: resolução conservadora; sem aplicação de evento ou acesso habilitado.
create table pcm.origem_campo_resolucoes (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references pcm.origem_campo_inbox(id),
  cliente_id uuid references pcm.clientes(id),
  os_id uuid references pcm.ordens_servico(id),
  resultado text not null check (resultado in (
    'os_identificada', 'cliente_desconhecido', 'os_nao_encontrada', 'cliente_divergente'
  )),
  criada_em timestamptz not null default now(),
  check ((resultado = 'os_identificada' and cliente_id is not null and os_id is not null)
    or (resultado <> 'os_identificada' and os_id is null))
);
create index origem_campo_resolucoes_envelope_idx
  on pcm.origem_campo_resolucoes(envelope_id, criada_em desc, id);
alter table pcm.origem_campo_resolucoes enable row level security;
alter table pcm.origem_campo_resolucoes force row level security;
revoke all on pcm.origem_campo_resolucoes from public, anon, authenticated, service_role;

create function pcm.sso_resolver_envelope_origem_campo(p_envelope_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_envelope pcm.origem_campo_inbox%rowtype;
  v_cliente uuid;
  v_os uuid;
  v_os_cliente uuid;
  v_resultado text;
  v_resolucao uuid;
begin
  if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id), false) then
    raise exception 'inbox_origem_campo_bloqueada' using errcode = '55000';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'servico_nao_autorizado' using errcode = '42501';
  end if;
  if p_envelope_id is null then
    raise exception 'envelope_invalido' using errcode = '22023';
  end if;
  select * into v_envelope from pcm.origem_campo_inbox where id = p_envelope_id for update;
  if not found then raise exception 'envelope_nao_encontrado' using errcode = '22023'; end if;
  if v_envelope.integracao <> 'auvo' then
    raise exception 'integracao_nao_suportada' using errcode = '22023';
  end if;

  -- Comparação textual evita conversão insegura de entrada externa para bigint.
  select c.id into v_cliente from pcm.clientes c
    where c.auvo_id::text = v_envelope.cliente_externo_id and c.deleted_at is null;
  if v_cliente is null then
    v_resultado := 'cliente_desconhecido';
  else
    select o.id, o.client_id into v_os, v_os_cliente from pcm.ordens_servico o
      where o.auvo_task_id = v_envelope.task_id and o.deleted_at is null;
    if v_os is null then
      v_resultado := 'os_nao_encontrada';
    elsif v_os_cliente is distinct from v_cliente then
      v_os := null;
      v_resultado := 'cliente_divergente';
    else
      v_resultado := 'os_identificada';
    end if;
  end if;

  insert into pcm.origem_campo_resolucoes(envelope_id, cliente_id, os_id, resultado)
    values (v_envelope.id, v_cliente, v_os, v_resultado) returning id into v_resolucao;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (null, 'origem_campo.resolucao', 'origem_campo_inbox', v_envelope.id,
      jsonb_build_object('resolucaoId', v_resolucao, 'resultado', v_resultado));
  return jsonb_build_object('resolucaoId', v_resolucao, 'envelopeId', v_envelope.id,
    'resultado', v_resultado, 'clienteId', v_cliente, 'osId', v_os, 'eventoAplicado', false);
end;
$$;
revoke all on function pcm.sso_resolver_envelope_origem_campo(uuid)
  from public, anon, authenticated, service_role;
