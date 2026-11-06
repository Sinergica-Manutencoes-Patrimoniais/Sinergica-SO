-- ADR-1296: consulta do pedido exato, sem gravação ou incorporação.
create table pcm.sso_recibo_recepcao_manual_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_recibo_recepcao_manual_gate(id, habilitado) values (true, false);
alter table pcm.sso_recibo_recepcao_manual_gate enable row level security;
alter table pcm.sso_recibo_recepcao_manual_gate force row level security;
revoke all on pcm.sso_recibo_recepcao_manual_gate from public, anon, authenticated, service_role;

create function pcm.sso_recibo_recepcao_manual(
  p_ator_id uuid, p_cliente_id uuid, p_request_id uuid,
  p_origem_declarada text, p_chave_origem text, p_linhas jsonb
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_payload jsonb;
  v_comando pcm.sso_levantamento_comandos%rowtype;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null
    or (p_origem_declarada is not null and p_origem_declarada not in ('planilha', 'auvo', 'campo'))
    or p_chave_origem is null or length(btrim(p_chave_origem)) not between 1 and 200
    or jsonb_typeof(p_linhas) is distinct from 'array' or octet_length(p_linhas::text) > 1048576 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_recibo_recepcao_manual_gate where id and habilitado for share;
  if not found then raise exception 'recibo_desabilitado' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.gerir', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'origem', 'manual', 'origemDeclarada', p_origem_declarada,
    'chaveOrigem', p_chave_origem, 'linhas', p_linhas);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into v_comando from pcm.sso_levantamento_comandos
    where request_id = p_request_id and ator_id = p_ator_id and payload = v_payload;
  if not found or not exists (
    select 1 from pcm.sso_levantamentos l
    where l.id::text = v_comando.resultado->>'aggregateId' and l.cliente_id = p_cliente_id
  ) then raise exception 'recibo_indisponivel' using errcode = '42501'; end if;
  return v_comando.resultado;
end; $$;
revoke all on function pcm.sso_recibo_recepcao_manual(uuid,uuid,uuid,text,text,jsonb) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_recibo_recepcao_manual(uuid,uuid,uuid,text,text,jsonb) to authenticated;
