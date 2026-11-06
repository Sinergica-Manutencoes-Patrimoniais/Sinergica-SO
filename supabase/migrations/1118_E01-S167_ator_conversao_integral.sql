-- ADR-0969: preparação privada; núcleo antigo torna-se inacessível diretamente.
create table pcm.sso_conversao_ator_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conversao_ator_gate(id,habilitado) values(true,false);
alter table pcm.sso_conversao_ator_gate enable row level security;
alter table pcm.sso_conversao_ator_gate force row level security;
revoke all on pcm.sso_conversao_ator_gate from public,anon,authenticated,service_role;

create function pcm.sso_converter_chamado_ator_conferido(p_request_id uuid,p_expected_revision bigint,p_chamado_id uuid,p_cliente_id uuid,
  p_os_id uuid,p_campos jsonb,p_destino text,p_status_hub text,p_ator_esperado uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_conversao_ator_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'conversao_ator_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_ator_esperado is distinct from auth.uid() or p_cliente_id is null or p_chamado_id is null
    or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return pcm.sso_converter_chamado_integral_autorizado(p_request_id,p_expected_revision,p_chamado_id,p_cliente_id,p_os_id,p_campos,p_destino,p_status_hub);
end; $$;
revoke all on function pcm.sso_converter_chamado_ator_conferido(uuid,bigint,uuid,uuid,uuid,jsonb,text,text,uuid) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_converter_chamado_integral_autorizado(uuid,bigint,uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated,service_role;
