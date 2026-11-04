-- ADR-1424: entrada limitada a devolver e reabrir; não abre o núcleo privado.
create table pcm.sso_mediacao_decisao_retorno_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_mediacao_decisao_retorno_gate(id, habilitado) values(true, false);
alter table pcm.sso_mediacao_decisao_retorno_gate enable row level security;
alter table pcm.sso_mediacao_decisao_retorno_gate force row level security;
revoke all on pcm.sso_mediacao_decisao_retorno_gate from public, anon, authenticated, service_role;

create function pcm.sso_decidir_retorno_mediado(p_request_id uuid, p_cliente_id uuid, p_retorno_id uuid,
  p_expected_revision integer, p_decisao text, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from pcm.sso_mediacao_decisao_retorno_gate where id and habilitado for share;
  if not found then raise exception 'decisao_retorno_bloqueada' using errcode='55000'; end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_decisao is null or p_decisao not in ('devolver','reabrir') then raise exception 'decisao_invalida' using errcode='22023'; end if;
  return pcm.sso_decidir_retorno_versionado(p_request_id,p_cliente_id,p_retorno_id,p_expected_revision,p_decisao,p_motivo);
end; $$;
revoke all on function pcm.sso_decidir_retorno_mediado(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_retorno_mediado(uuid,uuid,uuid,integer,text,text) to authenticated;
