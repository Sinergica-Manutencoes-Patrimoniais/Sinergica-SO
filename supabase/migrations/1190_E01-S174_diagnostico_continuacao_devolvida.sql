-- ADR-1038: projeção aditiva; o diagnóstico não encerra Chamado.
create table pcm.sso_diagnostico_continuacao_devolvida_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_continuacao_devolvida_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_continuacao_devolvida_gate enable row level security;
alter table pcm.sso_diagnostico_continuacao_devolvida_gate force row level security;
revoke all on pcm.sso_diagnostico_continuacao_devolvida_gate from public,anon,authenticated,service_role;
create function pcm.sso_diagnosticar_aptidao_continuacao_devolvida(p_ator_id uuid,p_cliente_id uuid,p_chamado_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;v_continuacoes bigint;v_revision bigint;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_chamado_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_diagnostico_continuacao_devolvida_gate where id and habilitado for share;
  if not found then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select c.sso_revisao into v_revision from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null for share;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  v_resultado:=pcm.sso_diagnosticar_aptidao_chamado(p_cliente_id,p_chamado_id);
  if (v_resultado->>'revision')::bigint is distinct from v_revision then raise exception 'revisao_alterada' using errcode='40001'; end if;
  select count(*) into v_continuacoes from pcm.chamado_continuacoes_propostas p where p.chamado_id=p_chamado_id and p.situacao='devolvida_backlog';
  return v_resultado||jsonb_build_object('continuacoesDevolvidas',v_continuacoes,'aptoIndicativo',case when v_continuacoes>0 then false else (v_resultado->>'aptoIndicativo')::boolean end);
end;
$$;
revoke all on function pcm.sso_diagnosticar_aptidao_continuacao_devolvida(uuid,uuid,uuid) from public,anon,authenticated,service_role;
