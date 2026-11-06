-- ADR-0112. Não aplicar sem validar escritores legados, Auvo e ordem de bloqueios.
create unique index uq_sso_alias_codigo_normalizado on pcm.sso_codigo_aliases (upper(btrim(codigo)));

create table pcm.sso_codigo_comandos (
  request_id uuid primary key,
  ator_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id),
  payload jsonb not null,
  resultado jsonb not null,
  criado_em timestamptz not null default now()
);
create table pcm.sso_codigo_permissoes_transacao (
  transacao bigint not null,
  tipo text not null check (tipo in ('sistema','componente')),
  ativo_id uuid not null,
  codigo_anterior text not null,
  codigo_novo text not null,
  primary key (transacao, tipo, ativo_id)
);
alter table pcm.sso_codigo_comandos enable row level security;
alter table pcm.sso_codigo_comandos force row level security;
alter table pcm.sso_codigo_permissoes_transacao enable row level security;
alter table pcm.sso_codigo_permissoes_transacao force row level security;
revoke all on pcm.sso_codigo_comandos, pcm.sso_codigo_permissoes_transacao from public, anon, authenticated, service_role;

create function pcm.sso_guardar_codigo_publico() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := case when tg_table_name = 'sistemas' then 'sistema' else 'componente' end;
  v_codigo text := case when tg_table_name = 'sistemas' then to_jsonb(new)->>'codigo' else to_jsonb(new)->>'identificador' end;
  v_antigo text;
  v_cliente uuid := case when tg_table_name = 'sistemas' then (to_jsonb(new)->>'cliente_id')::uuid else (to_jsonb(new)->>'client_id')::uuid end;
  v_cliente_antigo uuid;
begin
  if tg_op = 'UPDATE' then
    v_antigo := case when tg_table_name = 'sistemas' then to_jsonb(old)->>'codigo' else to_jsonb(old)->>'identificador' end;
    v_cliente_antigo := case when tg_table_name = 'sistemas' then (to_jsonb(old)->>'cliente_id')::uuid else (to_jsonb(old)->>'client_id')::uuid end;
    if v_codigo is not distinct from v_antigo and v_cliente is not distinct from v_cliente_antigo then return new; end if;
  end if;
  -- O escritor legado já pode ter lock da linha: falhar em vez de esperar evita inversão
  -- com a RPC, que adquire o lock global antes da linha. Cliente deve repetir a transação.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then
    raise exception 'codigo_concorrente_tente_novamente' using errcode = '40001';
  end if;
  if tg_op = 'UPDATE' then
    if v_cliente is distinct from v_cliente_antigo and exists (select 1 from pcm.sso_codigo_aliases a
      where (v_tipo = 'sistema' and a.sistema_id = new.id) or (v_tipo = 'componente' and a.componente_id = new.id)) then
      raise exception 'ativo_com_alias_nao_pode_mudar_cliente' using errcode = '23514';
    end if;
    if v_codigo is not distinct from v_antigo then return new; end if;
  end if;
  if tg_op = 'UPDATE' and not exists(select 1 from pcm.sso_codigo_permissoes_transacao p
    where p.transacao = pg_catalog.txid_current() and p.tipo = v_tipo and p.ativo_id = new.id
      and p.codigo_anterior is not distinct from v_antigo and p.codigo_novo is not distinct from v_codigo) then
    raise exception 'codigo_publico_protegido' using errcode = '42501';
  end if;
  if v_codigo is not null and btrim(v_codigo) <> '' and (
    exists(select 1 from pcm.sistemas s where upper(btrim(s.codigo)) = upper(btrim(v_codigo)) and not (v_tipo = 'sistema' and s.id = new.id))
    or exists(select 1 from pcm.equipamentos e where upper(btrim(e.identificador)) = upper(btrim(v_codigo)) and not (v_tipo = 'componente' and e.id = new.id))
    or exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo)) = upper(btrim(v_codigo)))
  ) then raise exception 'codigo_publico_em_uso' using errcode = '23505'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_codigo_publico() from public, anon, authenticated, service_role;
create trigger sso_codigo_sistema_guard before insert or update of codigo, cliente_id on pcm.sistemas
for each row execute function pcm.sso_guardar_codigo_publico();
create trigger sso_codigo_componente_guard before insert or update of identificador, client_id on pcm.equipamentos
for each row execute function pcm.sso_guardar_codigo_publico();

create function pcm.sso_substituir_codigo_publico(
  p_request_id uuid, p_tipo text, p_ativo_id uuid, p_codigo_anterior text, p_codigo_novo text, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid(); v_cliente uuid; v_codigo text; v_alias uuid;
  v_payload jsonb; v_resultado jsonb; v_comando pcm.sso_codigo_comandos%rowtype;
begin
  if v_actor is null or p_request_id is null or p_tipo is null or p_tipo not in ('sistema','componente') or p_ativo_id is null
    or p_codigo_anterior is null or length(btrim(p_codigo_anterior)) not between 1 and 200
    or p_codigo_novo is null or length(p_codigo_novo) not between 1 and 200 or p_codigo_novo <> upper(btrim(p_codigo_novo))
    or p_codigo_novo ~ '[[:space:]]' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
    raise exception 'substituicao_invalida' using errcode = '22023';
  end if;
  v_payload := jsonb_build_object('tipo', p_tipo, 'ativoId', p_ativo_id, 'codigoAnterior', p_codigo_anterior,
    'codigoNovo', p_codigo_novo, 'motivo', btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('codigo-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.sso_codigo_comandos where request_id = p_request_id;
  if v_comando.request_id is not null then
    if v_comando.ator_id is distinct from v_actor or not config.sso_autorizar_acao('codigo.substituir', v_comando.cliente_id)
      or not exists(select 1 from config.usuarios u where u.user_id = v_actor and u.ativo and u.papel = 'superadmin' and auth.jwt()->>'user_role' = 'superadmin') then
      raise exception 'codigo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
    end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-codigos-publicos', 0));
  if p_tipo = 'sistema' then
    select cliente_id, codigo into v_cliente, v_codigo from pcm.sistemas where id = p_ativo_id and deleted_at is null for update;
  else
    select client_id, identificador into v_cliente, v_codigo from pcm.equipamentos where id = p_ativo_id and deleted_at is null for update;
  end if;
  if v_cliente is null or not config.sso_autorizar_acao('codigo.substituir', v_cliente)
    or not exists(select 1 from config.usuarios u where u.user_id = v_actor and u.ativo and u.papel = 'superadmin' and auth.jwt()->>'user_role' = 'superadmin') then
    raise exception 'codigo_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if v_codigo is distinct from p_codigo_anterior then raise exception 'codigo_anterior_divergente' using errcode = '40001'; end if;
  if upper(btrim(p_codigo_anterior)) = upper(btrim(p_codigo_novo)) then raise exception 'codigo_sem_alteracao' using errcode = '22023'; end if;
  if exists(select 1 from pcm.sistemas s where upper(btrim(s.codigo)) = upper(btrim(v_codigo)) and not (p_tipo = 'sistema' and s.id = p_ativo_id))
    or exists(select 1 from pcm.equipamentos e where upper(btrim(e.identificador)) = upper(btrim(v_codigo)) and not (p_tipo = 'componente' and e.id = p_ativo_id))
    or exists(select 1 from pcm.sso_codigo_aliases a where upper(btrim(a.codigo)) = upper(btrim(v_codigo))) then
    raise exception 'codigo_anterior_ambiguo' using errcode = '23505';
  end if;
  insert into pcm.sso_codigo_aliases(cliente_id, sistema_id, componente_id, codigo, criado_por, motivo)
    values (v_cliente, case when p_tipo = 'sistema' then p_ativo_id end,
      case when p_tipo = 'componente' then p_ativo_id end, v_codigo, v_actor, btrim(p_motivo)) returning id into v_alias;
  insert into pcm.sso_codigo_permissoes_transacao(transacao, tipo, ativo_id, codigo_anterior, codigo_novo)
    values (pg_catalog.txid_current(), p_tipo, p_ativo_id, v_codigo, p_codigo_novo);
  if p_tipo = 'sistema' then update pcm.sistemas set codigo = p_codigo_novo where id = p_ativo_id;
  else update pcm.equipamentos set identificador = p_codigo_novo where id = p_ativo_id; end if;
  delete from pcm.sso_codigo_permissoes_transacao where transacao = pg_catalog.txid_current() and tipo = p_tipo and ativo_id = p_ativo_id;
  v_resultado := jsonb_build_object('ativoId', p_ativo_id, 'tipo', p_tipo, 'codigoAtual', p_codigo_novo, 'aliasId', v_alias, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload) values (v_actor, 'codigo.substituido', p_tipo, p_ativo_id,
    jsonb_build_object('requestId', p_request_id, 'clienteId', v_cliente, 'codigoAnterior', v_codigo, 'codigoNovo', p_codigo_novo, 'motivo', btrim(p_motivo)));
  insert into pcm.sso_codigo_comandos(request_id, ator_id, cliente_id, payload, resultado) values (p_request_id, v_actor, v_cliente, v_payload, v_resultado);
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_substituir_codigo_publico(uuid,text,uuid,text,text,text) from public, anon, service_role;
grant execute on function pcm.sso_substituir_codigo_publico(uuid,text,uuid,text,text,text) to authenticated;
