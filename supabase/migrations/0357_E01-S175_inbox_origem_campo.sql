-- ADR-0132: inbox privada e desconectada do webhook/import operacional.
create table pcm.origem_campo_inbox_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
alter table pcm.origem_campo_inbox_gate enable row level security;
alter table pcm.origem_campo_inbox_gate force row level security;
revoke all on pcm.origem_campo_inbox_gate from public, anon, authenticated, service_role;
insert into pcm.origem_campo_inbox_gate(id, habilitado) values (true, false);

create table pcm.origem_campo_inbox (
  id uuid primary key default gen_random_uuid(),
  integracao text not null check (length(integracao) between 1 and 120),
  task_id bigint not null check (task_id > 0),
  chave_evento text not null check (length(chave_evento) between 1 and 250),
  cliente_externo_id text check (cliente_externo_id is null or length(cliente_externo_id) between 1 and 120),
  ocorrido_em timestamptz check (ocorrido_em is null or isfinite(ocorrido_em)),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  recebido_em timestamptz not null default now(),
  unique (integracao, task_id, chave_evento)
);
create index origem_campo_inbox_recebido_idx on pcm.origem_campo_inbox(recebido_em, id);
alter table pcm.origem_campo_inbox enable row level security;
alter table pcm.origem_campo_inbox force row level security;
revoke all on pcm.origem_campo_inbox from public, anon, authenticated, service_role;

create function pcm.sso_receber_envelope_origem_campo(
  p_integracao text, p_task_id bigint, p_chave_evento text,
  p_cliente_externo_id text, p_ocorrido_em timestamptz, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_evento pcm.origem_campo_inbox%rowtype;
  v_criado boolean;
begin
  if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id), false) then
    raise exception 'inbox_origem_campo_bloqueada' using errcode = '55000';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'servico_nao_autorizado' using errcode = '42501';
  end if;
  if p_integracao is null or p_integracao <> btrim(p_integracao) or length(p_integracao) not between 1 and 120
    or p_task_id is null or p_task_id < 1 or p_chave_evento is null
    or p_chave_evento <> btrim(p_chave_evento) or length(p_chave_evento) not between 1 and 250
    or (p_cliente_externo_id is not null and (p_cliente_externo_id <> btrim(p_cliente_externo_id)
      or length(p_cliente_externo_id) not between 1 and 120))
    or (p_ocorrido_em is not null and not isfinite(p_ocorrido_em))
    or p_payload is null or jsonb_typeof(p_payload) is distinct from 'object'
    or octet_length(p_payload::text) > 262144 then
    raise exception 'envelope_invalido' using errcode = '22023';
  end if;

  insert into pcm.origem_campo_inbox(integracao, task_id, chave_evento, cliente_externo_id, ocorrido_em, payload)
    values (p_integracao, p_task_id, p_chave_evento, p_cliente_externo_id, p_ocorrido_em, p_payload)
    on conflict (integracao, task_id, chave_evento) do nothing returning * into v_evento;
  v_criado := found;
  if not v_criado then
    select * into strict v_evento from pcm.origem_campo_inbox
      where integracao = p_integracao and task_id = p_task_id and chave_evento = p_chave_evento;
    if v_evento.cliente_externo_id is distinct from p_cliente_externo_id
      or v_evento.ocorrido_em is distinct from p_ocorrido_em or v_evento.payload is distinct from p_payload then
      raise exception 'evento_conflitante' using errcode = '23505';
    end if;
  else
    insert into audit.events(actor_id, action, entity, entity_id, payload)
      values (null, 'origem_campo.envelope_recebido', 'origem_campo_inbox', v_evento.id,
        jsonb_build_object('integracao', p_integracao, 'taskId', p_task_id, 'chaveEvento', p_chave_evento));
  end if;
  return jsonb_build_object('envelopeId', v_evento.id, 'criado', v_criado, 'estado', 'pendente');
end;
$$;
revoke all on function pcm.sso_receber_envelope_origem_campo(text, bigint, text, text, timestamptz, jsonb)
  from public, anon, authenticated, service_role;
