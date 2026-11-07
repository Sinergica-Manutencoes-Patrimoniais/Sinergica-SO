-- ADR-1322: cancelamento de tentativa, sem reverter aprovações ou incorporar cadastros.
create table pcm.sso_cancelamento_aprovacao_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_cancelamento_aprovacao_gate(id, habilitado) values (true, false);
create table pcm.sso_aprovacao_tentativas_canceladas (
  request_id uuid primary key,
  lote_id uuid not null references pcm.sso_levantamentos(id),
  cliente_id uuid not null,
  ator_id uuid not null references auth.users(id),
  cancelado_em timestamptz not null default now()
);
alter table pcm.sso_cancelamento_aprovacao_gate enable row level security;
alter table pcm.sso_cancelamento_aprovacao_gate force row level security;
alter table pcm.sso_aprovacao_tentativas_canceladas enable row level security;
alter table pcm.sso_aprovacao_tentativas_canceladas force row level security;
revoke all on pcm.sso_cancelamento_aprovacao_gate, pcm.sso_aprovacao_tentativas_canceladas from public, anon, authenticated, service_role;

create function pcm.sso_aprovacao_cancelamento_imutavel() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'historico_imutavel' using errcode = '23514'; end $$;
revoke all on function pcm.sso_aprovacao_cancelamento_imutavel() from public, anon, authenticated, service_role;
create trigger sso_aprovacao_cancelamento_imutavel before update or delete on pcm.sso_aprovacao_tentativas_canceladas
  for each row execute function pcm.sso_aprovacao_cancelamento_imutavel();

create function pcm.sso_exigir_aprovacao_nao_cancelada(p_request_id uuid, p_lote_id uuid, p_ator_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from pcm.sso_aprovacao_tentativas_canceladas
    where request_id = p_request_id and lote_id = p_lote_id and ator_id = p_ator_id) then
    raise exception 'tentativa_cancelada' using errcode = '55000';
  end if;
end $$;
revoke all on function pcm.sso_exigir_aprovacao_nao_cancelada(uuid, uuid, uuid) from public, anon, authenticated, service_role;

-- A guarda é inserida somente após a trava já existente da aprovação; falha se a definição mudou.
do $$
declare
  v_funcao regprocedure := 'pcm.sso_aprovar_linhas_parcialmente(uuid,uuid,integer,jsonb,text,boolean)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_antes text := 'perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));select * into v_lote';
  v_depois text := 'perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));perform pcm.sso_exigir_aprovacao_nao_cancelada(p_request_id,p_lote_id,auth.uid());select * into v_lote';
begin
  if strpos(v_definicao, v_antes) = 0 or length(v_definicao) - length(replace(v_definicao, v_antes, '')) <> length(v_antes) then
    raise exception 'definicao_aprovacao_incompativel' using errcode = '55000';
  end if;
  execute replace(v_definicao, v_antes, v_depois);
end $$;

create function pcm.sso_cancelar_tentativa_aprovacao(
  p_request_id uuid, p_ator_esperado uuid, p_cliente_id uuid, p_lote_id uuid
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_cmd pcm.sso_levantamento_comandos%rowtype; v_cancelada pcm.sso_aprovacao_tentativas_canceladas%rowtype;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_cancelamento_aprovacao_gate where id and habilitado for share;
  if not found then raise exception 'cancelamento_desabilitado' using errcode = '55000'; end if;
  if v_ator is null or v_ator is distinct from p_ator_esperado or p_request_id is null or p_lote_id is null or p_cliente_id is null or
     config.sso_autorizar_acao('cadastro.aprovar', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  perform 1 from pcm.sso_levantamentos where id = p_lote_id and cliente_id = p_cliente_id for update;
  if not found or config.sso_autorizar_acao('cadastro.aprovar', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  select * into v_cmd from pcm.sso_levantamento_comandos where request_id = p_request_id;
  if found then
    if v_cmd.ator_id is distinct from v_ator or v_cmd.payload->>'operacao' is distinct from 'aprovar_linhas_parcialmente' or v_cmd.payload->>'loteId' is distinct from p_lote_id::text then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return jsonb_build_object('requestId', p_request_id, 'loteId', p_lote_id, 'estado', 'confirmado');
  end if;
  select * into v_cancelada from pcm.sso_aprovacao_tentativas_canceladas where request_id = p_request_id;
  if found then
    if v_cancelada.ator_id is distinct from v_ator or v_cancelada.cliente_id is distinct from p_cliente_id or v_cancelada.lote_id is distinct from p_lote_id then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
  else
    insert into pcm.sso_aprovacao_tentativas_canceladas(request_id, lote_id, cliente_id, ator_id) values (p_request_id, p_lote_id, p_cliente_id, v_ator);
    insert into audit.events(actor_id, action, entity, entity_id, payload) values (v_ator, 'levantamento.tentativa_aprovacao_cancelada', 'sso_levantamentos', p_lote_id, jsonb_build_object('clienteId', p_cliente_id, 'requestId', p_request_id));
  end if;
  return jsonb_build_object('requestId', p_request_id, 'loteId', p_lote_id, 'estado', 'cancelado');
end $$;
revoke all on function pcm.sso_cancelar_tentativa_aprovacao(uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_cancelar_tentativa_aprovacao(uuid, uuid, uuid, uuid) to authenticated;
