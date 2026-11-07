-- ADR-1031: associação manual declarada; não comprova origem nem baixa fotos.
create table pcm.sso_recepcao_envelope_campo_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_recepcao_envelope_campo_gate(id, habilitado) values (true, false);
alter table pcm.sso_recepcao_envelope_campo_gate enable row level security;
alter table pcm.sso_recepcao_envelope_campo_gate force row level security;
revoke all on pcm.sso_recepcao_envelope_campo_gate from public, anon, authenticated, service_role;

create table pcm.sso_recepcao_envelope_campo (
  envelope_id uuid primary key references pcm.origem_campo_inbox(id),
  cliente_id uuid not null references pcm.clientes(id),
  os_id uuid not null references pcm.ordens_servico(id),
  lote_id uuid not null unique references pcm.sso_levantamentos(id),
  request_id uuid not null unique,
  ator_id uuid not null references config.usuarios(user_id),
  linhas jsonb not null,
  fotos_declaradas jsonb not null,
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table pcm.sso_recepcao_envelope_campo enable row level security;
alter table pcm.sso_recepcao_envelope_campo force row level security;
revoke all on pcm.sso_recepcao_envelope_campo from public, anon, authenticated, service_role;
create trigger sso_recepcao_envelope_campo_imutavel before update or delete on pcm.sso_recepcao_envelope_campo
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_receber_envelope_campo_manual(
  p_ator_id uuid, p_cliente_id uuid, p_os_id uuid, p_envelope_id uuid,
  p_request_id uuid, p_linhas jsonb, p_fotos jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_envelope pcm.origem_campo_inbox%rowtype;
  v_anterior pcm.sso_recepcao_envelope_campo%rowtype;
  v_lote jsonb;
  v_resultado jsonb;
  v_linha jsonb;
  v_atributos jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode = '42501'; end if;
  if p_cliente_id is null or p_os_id is null or p_envelope_id is null or p_request_id is null
    or pg_catalog.jsonb_typeof(p_linhas) is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_fotos) is distinct from 'array'
    or pg_catalog.octet_length(p_linhas::text) > 1048576
    or pg_catalog.octet_length(p_fotos::text) > 262144 then raise exception 'recepcao_invalida' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_recepcao_envelope_campo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'recepcao_envelope_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-recepcao-envelope:' || p_envelope_id::text, 0));
  select * into v_envelope from pcm.origem_campo_inbox where id = p_envelope_id for update;
  if not found or v_envelope.integracao <> 'auvo' then raise exception 'envelope_indisponivel' using errcode = '42501'; end if;
  perform 1 from pcm.sso_origem_campo_triagens t where t.envelope_id = p_envelope_id and t.cliente_id = p_cliente_id for share;
  if not found then raise exception 'triagem_indisponivel_ou_divergente' using errcode = '23514'; end if;
  if exists (select 1 from pcm.origem_campo_resolucoes r where r.envelope_id = p_envelope_id
    and r.resultado = 'os_identificada' and (r.cliente_id is distinct from p_cliente_id or r.os_id is distinct from p_os_id)) then
    raise exception 'resolucao_exige_reconciliacao' using errcode = '23514';
  end if;
  perform 1 from pcm.clientes c join pcm.ordens_servico o on o.client_id = c.id
    where c.id = p_cliente_id and c.deleted_at is null
      and o.id = p_os_id and o.deleted_at is null and o.auvo_task_id = v_envelope.task_id for share of c, o;
  if not found then raise exception 'vinculo_indisponivel' using errcode = '42501'; end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if pg_catalog.jsonb_array_length(p_linhas) not between 1 and 1000 then raise exception 'linhas_invalidas' using errcode = '22023'; end if;
  for v_linha in select value from pg_catalog.jsonb_array_elements(p_linhas) loop
    if pg_catalog.jsonb_typeof(v_linha) is distinct from 'object'
      or (v_linha - 'chave' - 'tipo' - 'atributos') <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(v_linha->'chave') is distinct from 'string'
      or length(btrim(v_linha->>'chave')) not between 1 and 200
      or v_linha->>'chave' <> btrim(v_linha->>'chave')
      or pg_catalog.jsonb_typeof(v_linha->'tipo') is distinct from 'string'
      or v_linha->>'tipo' not in ('area','local','sublocal','sistema','equipamento','componente','grupo_quantitativo')
      or pg_catalog.jsonb_typeof(v_linha->'atributos') is distinct from 'object'
      or pg_catalog.octet_length(v_linha::text) > 32768 then
      raise exception 'linha_invalida' using errcode = '22023';
    end if;
    v_atributos := v_linha->'atributos';
    if pg_catalog.jsonb_typeof(v_atributos->'nome') is distinct from 'string'
      or length(btrim(v_atributos->>'nome')) not between 1 and 4000
      or exists (select 1 from pg_catalog.jsonb_each(v_atributos) a where
        a.key not in ('nome','observacoes','quantidade','codigoInformado','referenciaPai','sistemaProvisorio','localProvisorio','classificacao')
        or case when a.key = 'quantidade' then
          case when pg_catalog.jsonb_typeof(a.value) = 'number' then (a.value #>> '{}')::numeric < 0 else true end
        else pg_catalog.jsonb_typeof(a.value) is distinct from 'string' or length(a.value #>> '{}') > 4000 end) then
      raise exception 'atributos_invalidos' using errcode = '22023';
    end if;
  end loop;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_linhas) l group by l->>'chave' having count(*) > 1) then
    raise exception 'chave_linha_duplicada' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_fotos) > 10000 or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_fotos) f
    where pg_catalog.jsonb_typeof(f) is distinct from 'object' or (f - 'chaveLinha' - 'referencia') <> '{}'::jsonb
      or pg_catalog.jsonb_typeof(f->'chaveLinha') is distinct from 'string'
      or length(btrim(f->>'chaveLinha')) not between 1 and 200
      or pg_catalog.jsonb_typeof(f->'referencia') is distinct from 'string'
      or length(btrim(f->>'referencia')) not between 1 and 200
      or f->>'referencia' <> btrim(f->>'referencia')
      or not exists (select 1 from pg_catalog.jsonb_array_elements(p_linhas) l where l->>'chave' = f->>'chaveLinha')
  ) or exists (select 1 from pg_catalog.jsonb_array_elements(p_fotos) f group by f->>'chaveLinha', f->>'referencia' having count(*) > 1) then
    raise exception 'referencias_foto_invalidas' using errcode = '22023';
  end if;
  select * into v_anterior from pcm.sso_recepcao_envelope_campo where envelope_id = p_envelope_id;
  if found then
    if v_anterior.request_id is distinct from p_request_id or v_anterior.ator_id is distinct from p_ator_id
      or v_anterior.cliente_id is distinct from p_cliente_id or v_anterior.os_id is distinct from p_os_id
      or v_anterior.linhas is distinct from p_linhas or v_anterior.fotos_declaradas is distinct from p_fotos then
      raise exception 'envelope_ou_request_conflitante' using errcode = '23505';
    end if;
    return v_anterior.resultado;
  end if;
  v_lote := pcm.sso_receber_levantamento_manual(p_request_id, p_cliente_id, 'auvo', 'envelope-campo:' || p_envelope_id::text, p_linhas);
  if (v_lote->'created') is distinct from 'true'::jsonb then
    raise exception 'lote_preexistente_exige_reconciliacao' using errcode = '23505';
  end if;
  v_resultado := pg_catalog.jsonb_build_object('requestId', p_request_id, 'envelopeId', p_envelope_id,
    'loteId', v_lote->>'aggregateId', 'estado', 'pendente', 'origemComprovada', false,
    'fotosImportadas', false, 'cadastrosIncorporados', false);
  insert into pcm.sso_recepcao_envelope_campo(envelope_id, cliente_id, os_id, lote_id, request_id, ator_id, linhas, fotos_declaradas, resultado)
    values (p_envelope_id, p_cliente_id, p_os_id, (v_lote->>'aggregateId')::uuid, p_request_id, p_ator_id, p_linhas, p_fotos, v_resultado);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (p_ator_id, 'levantamento.envelope_declarado', 'origem_campo_inbox', p_envelope_id,
      pg_catalog.jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'osId', p_os_id, 'loteId', v_lote->>'aggregateId', 'fotosDeclaradas', pg_catalog.jsonb_array_length(p_fotos)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_receber_envelope_campo_manual(uuid, uuid, uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
