-- ADR-0138: fundação privada e inerte; nenhuma inferência sobre cadastros anteriores.
-- Um rascunho pode ainda não ter código; o token de permissão é interno e transacional.
alter table pcm.sso_codigo_permissoes_transacao alter column codigo_anterior drop not null;
create table pcm.sso_codigo_ciclo (
  tipo text not null check (tipo in ('sistema', 'componente')),
  ativo_id uuid not null,
  cliente_id uuid not null references pcm.clientes(id),
  revisao integer not null default 1 check (revisao > 0),
  aprovado_em timestamptz,
  sincronizado_em timestamptz,
  etiquetado_em timestamptz,
  referenciado_os_em timestamptz,
  criado_em timestamptz not null default now(),
  primary key (tipo, ativo_id)
);
alter table pcm.sso_codigo_ciclo enable row level security;
alter table pcm.sso_codigo_ciclo force row level security;
revoke all on pcm.sso_codigo_ciclo from public, anon, authenticated, service_role;

create table pcm.sso_codigo_rascunho_gate (
  chave boolean primary key default true check (chave),
  habilitado boolean not null default false
);
insert into pcm.sso_codigo_rascunho_gate(chave, habilitado) values (true, false);
alter table pcm.sso_codigo_rascunho_gate enable row level security;
alter table pcm.sso_codigo_rascunho_gate force row level security;
revoke all on pcm.sso_codigo_rascunho_gate from public, anon, authenticated, service_role;

create function pcm.sso_guardar_marcos_codigo() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'ciclo_codigo_imutavel' using errcode = '23514'; end if;
  if new.tipo is distinct from old.tipo or new.ativo_id is distinct from old.ativo_id
    or new.cliente_id is distinct from old.cliente_id or new.criado_em is distinct from old.criado_em
    or new.revisao <> old.revisao + 1
    or (old.aprovado_em is not null and new.aprovado_em is distinct from old.aprovado_em)
    or (old.sincronizado_em is not null and new.sincronizado_em is distinct from old.sincronizado_em)
    or (old.etiquetado_em is not null and new.etiquetado_em is distinct from old.etiquetado_em)
    or (old.referenciado_os_em is not null and new.referenciado_os_em is distinct from old.referenciado_os_em) then
    raise exception 'marco_codigo_imutavel' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_marcos_codigo() from public, anon, authenticated, service_role;
create trigger sso_codigo_ciclo_guard before update or delete on pcm.sso_codigo_ciclo
  for each row execute function pcm.sso_guardar_marcos_codigo();

create function pcm.sso_editar_codigo_rascunho(
  p_request_id uuid, p_tipo text, p_ativo_id uuid, p_expected_revision integer,
  p_codigo_anterior text, p_codigo_novo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid(); v_cliente uuid; v_codigo text; v_auvo_id bigint; v_auvo_equipment_id bigint;
  v_ciclo pcm.sso_codigo_ciclo%rowtype; v_comando pcm.sso_codigo_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_codigo_rascunho_gate where chave), false) then
    raise exception 'edicao_codigo_rascunho_desabilitada' using errcode = '55000';
  end if;
  if v_ator is null or p_request_id is null or p_tipo is null or p_tipo not in ('sistema', 'componente') or p_ativo_id is null
    or p_expected_revision is null or p_expected_revision < 1 or p_codigo_novo is null
    or length(p_codigo_novo) not between 1 and 200 or p_codigo_novo <> upper(btrim(p_codigo_novo))
    or p_codigo_novo ~ '[[:space:]]' then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('operacao', 'editarRascunho', 'tipo', p_tipo, 'ativoId', p_ativo_id,
    'expectedRevision', p_expected_revision, 'codigoAnterior', p_codigo_anterior, 'codigoNovo', p_codigo_novo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('codigo-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.sso_codigo_comandos where request_id = p_request_id;
  if found then
    if v_comando.ator_id is distinct from v_ator or config.sso_autorizar_acao('cadastro.gerir', v_comando.cliente_id) is not true then
      raise exception 'ativo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0));
  select * into v_ciclo from pcm.sso_codigo_ciclo where tipo = p_tipo and ativo_id = p_ativo_id for update;
  if not found or config.sso_autorizar_acao('cadastro.gerir', v_ciclo.cliente_id) is not true then
    raise exception 'ativo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_ciclo.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if num_nonnulls(v_ciclo.aprovado_em, v_ciclo.sincronizado_em, v_ciclo.etiquetado_em, v_ciclo.referenciado_os_em) <> 0 then
    raise exception 'codigo_publico_protegido' using errcode = '23514';
  end if;
  if p_tipo = 'sistema' then
    select cliente_id, codigo, auvo_id, auvo_equipment_id into v_cliente, v_codigo, v_auvo_id, v_auvo_equipment_id
      from pcm.sistemas where id = p_ativo_id and deleted_at is null for update;
  else
    select client_id, identificador, auvo_id, auvo_equipment_id into v_cliente, v_codigo, v_auvo_id, v_auvo_equipment_id
      from pcm.equipamentos where id = p_ativo_id and deleted_at is null for update;
  end if;
  if v_cliente is distinct from v_ciclo.cliente_id or v_auvo_id is not null or v_auvo_equipment_id is not null
    or exists (select 1 from pcm.ordens_servico o where (p_tipo = 'sistema' and o.sistema_id = p_ativo_id)
      or (p_tipo = 'componente' and o.equipamento_id = p_ativo_id))
    or exists (select 1 from pcm.sso_codigo_aliases a where (p_tipo = 'sistema' and a.sistema_id = p_ativo_id)
      or (p_tipo = 'componente' and a.componente_id = p_ativo_id)) then
    raise exception 'codigo_publico_protegido' using errcode = '23514';
  end if;
  if v_codigo is distinct from p_codigo_anterior then raise exception 'codigo_anterior_divergente' using errcode = '40001'; end if;
  if v_codigo = p_codigo_novo then raise exception 'codigo_sem_alteracao' using errcode = '22023'; end if;
  insert into pcm.sso_codigo_permissoes_transacao(transacao, tipo, ativo_id, codigo_anterior, codigo_novo)
    values (pg_catalog.txid_current(), p_tipo, p_ativo_id, v_codigo, p_codigo_novo);
  if p_tipo = 'sistema' then update pcm.sistemas set codigo = p_codigo_novo where id = p_ativo_id;
  else update pcm.equipamentos set identificador = p_codigo_novo where id = p_ativo_id; end if;
  delete from pcm.sso_codigo_permissoes_transacao where transacao = pg_catalog.txid_current() and tipo = p_tipo and ativo_id = p_ativo_id;
  update pcm.sso_codigo_ciclo set revisao = revisao + 1 where tipo = p_tipo and ativo_id = p_ativo_id returning * into v_ciclo;
  v_resultado := jsonb_build_object('ativoId', p_ativo_id, 'tipo', p_tipo, 'codigoAtual', p_codigo_novo,
    'revision', v_ciclo.revisao, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'codigo.rascunho_editado', 'codigo_publico', p_ativo_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'tipo', p_tipo,
        'codigoAnterior', v_codigo, 'codigoNovo', p_codigo_novo, 'revision', v_ciclo.revisao));
  insert into pcm.sso_codigo_comandos(request_id, ator_id, cliente_id, payload, resultado)
    values (p_request_id, v_ator, v_cliente, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_editar_codigo_rascunho(uuid,text,uuid,integer,text,text)
  from public, anon, authenticated, service_role;
