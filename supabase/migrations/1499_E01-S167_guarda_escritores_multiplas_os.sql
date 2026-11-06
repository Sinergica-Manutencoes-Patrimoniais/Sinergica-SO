-- ADR-1351: preparação aditiva; não remove restrições legadas nem abre gates.
create table pcm.sso_guarda_multiplas_os_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_guarda_multiplas_os_gate(id, habilitado) values(true, false);
alter table pcm.sso_guarda_multiplas_os_gate enable row level security;
alter table pcm.sso_guarda_multiplas_os_gate force row level security;
revoke all on pcm.sso_guarda_multiplas_os_gate from public, anon, authenticated, service_role;

create table pcm.sso_guarda_multiplas_os_tokens(
  txid bigint not null, ator_id uuid not null, chamado_id uuid not null, cliente_id uuid not null, os_id uuid not null,
  primary key(txid, ator_id, chamado_id, cliente_id, os_id)
);
alter table pcm.sso_guarda_multiplas_os_tokens enable row level security;
alter table pcm.sso_guarda_multiplas_os_tokens force row level security;
revoke all on pcm.sso_guarda_multiplas_os_tokens from public, anon, authenticated, service_role;

create function pcm.sso_guardar_novo_vinculo_chamado_os() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
declare v_cliente uuid; v_habilitada boolean;
begin
  if new.chamado_id is null or new.deleted_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.chamado_id is not distinct from new.chamado_id
    and old.client_id is not distinct from new.client_id and old.deleted_at is null then return new; end if;
  select habilitado into v_habilitada from pcm.sso_guarda_multiplas_os_gate where id for share;
  if not coalesce(v_habilitada, false) then
    if pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado') is null then
      raise exception 'guarda_multiplas_os_desabilitada' using errcode = '55000'; end if;
    return new;
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  select c.cliente_id into v_cliente from pcm.chamados c where c.id = new.chamado_id and c.deleted_at is null for update nowait;
  if not found or v_cliente is distinct from new.client_id then
    raise exception 'chamado_ou_cliente_invalido' using errcode = '23514'; end if;
  if exists(select 1 from pcm.ordens_servico o where o.chamado_id = new.chamado_id and o.deleted_at is null and o.id <> new.id)
    and not exists(select 1 from pcm.sso_guarda_multiplas_os_tokens t where t.txid = pg_catalog.txid_current()
      and t.ator_id = auth.uid() and t.chamado_id = new.chamado_id and t.cliente_id = new.client_id and t.os_id = new.id) then
    raise exception 'novo_vinculo_exige_comando_chamado_os' using errcode = '23514'; end if;
  return new;
end; $$;
revoke all on function pcm.sso_guardar_novo_vinculo_chamado_os() from public, anon, authenticated, service_role;
create trigger sso_guardar_novo_vinculo_chamado_os before insert or update of chamado_id, client_id, deleted_at
  on pcm.ordens_servico for each row execute function pcm.sso_guardar_novo_vinculo_chamado_os();

do $migration$
declare
  v_funcao regprocedure := 'pcm.sso_criar_os_chamado(uuid,bigint,uuid,uuid,uuid,text,text,text)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_antes text := $texto$perform set_config('app.auvo_sync_write', 'true', true);$texto$;
  v_depois text := $texto$perform set_config('app.auvo_sync_write', coalesce(v_sync_anterior, ''), true);$texto$;
begin
  if length(v_definicao) - length(replace(v_definicao, v_antes, '')) <> length(v_antes)
    or length(v_definicao) - length(replace(v_definicao, v_depois, '')) <> length(v_depois) then
    raise exception 'definicao_criacao_os_incompativel' using errcode = '55000'; end if;
  v_definicao := replace(v_definicao, v_antes, v_antes || $texto$
  insert into pcm.sso_guarda_multiplas_os_tokens(txid, ator_id, chamado_id, cliente_id, os_id)
    values(pg_catalog.txid_current(), v_actor, p_chamado_id, p_cliente_id, p_os_id);$texto$);
  v_definicao := replace(v_definicao, v_depois, $texto$delete from pcm.sso_guarda_multiplas_os_tokens where txid = pg_catalog.txid_current()
    and ator_id = v_actor and chamado_id = p_chamado_id and cliente_id = p_cliente_id and os_id = p_os_id;
  $texto$ || v_depois);
  execute v_definicao;
end;
$migration$;
