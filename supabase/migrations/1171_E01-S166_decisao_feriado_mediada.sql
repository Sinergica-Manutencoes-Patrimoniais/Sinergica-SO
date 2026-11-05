-- ADR-1020: entrada privada, não habilitada.
create table pcm.sso_decisao_feriado_mediada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_decisao_feriado_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_decisao_feriado_mediada_gate enable row level security;
alter table pcm.sso_decisao_feriado_mediada_gate force row level security;
revoke all on pcm.sso_decisao_feriado_mediada_gate from public,anon,authenticated,service_role;
create function pcm.sso_decidir_feriado_mediado(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_feriado_id uuid,p_expected_revision integer,p_acao text,p_contrato_id uuid,p_data date,p_fonte text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or p_ator_id is distinct from auth.uid() then raise exception 'sessao_invalida' using errcode='42501'; end if;
  if p_cliente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_decisao_feriado_mediada_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'decisao_feriado_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.feriado_declarado_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'feriados_bloqueados' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return pcm.sso_decidir_feriado_declarado(p_request_id,p_cliente_id,p_feriado_id,p_expected_revision,p_acao,p_contrato_id,p_data,p_fonte,p_motivo);
end;
$$;
revoke all on function pcm.sso_decidir_feriado_mediado(uuid,uuid,uuid,uuid,integer,text,uuid,date,text,text) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_decidir_feriado_declarado(uuid,uuid,uuid,integer,text,uuid,date,text,text) from public,anon,authenticated,service_role;
