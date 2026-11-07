-- ADR-0878: preservar SECURITY INVOKER e RLS nativa; não habilitar o gate.
create function pcm.sso_exigir_agenda_tecnico_capacidade() returns void
language plpgsql volatile security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.capacidade_agenda_tecnico_gate g where g.id),false) then
    raise exception 'agenda_capacidade_bloqueada' using errcode='55000';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.capacidade_agenda_tecnico_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.capacidade_agenda_tecnico_gate g where g.id),false) then
    raise exception 'agenda_capacidade_bloqueada' using errcode='55000';
  end if;
end;
$$;
revoke all on function pcm.sso_exigir_agenda_tecnico_capacidade() from public,anon,authenticated,service_role;
grant execute on function pcm.sso_exigir_agenda_tecnico_capacidade() to authenticated;

create or replace function pcm.sso_listar_agenda_tecnico_capacidade(p_cliente_id uuid,p_semana_inicio date,p_apos_data date default null,p_apos_id uuid default null,p_limite integer default 50)
returns table(id uuid,funcionario_id uuid,data date,hora_inicio time,hora_fim time)
language plpgsql volatile security invoker set search_path='' as $$
begin
 perform pcm.sso_exigir_agenda_tecnico_capacidade();
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 or p_limite is null or p_limite not between 1 and 100 or ((p_apos_data is null)<>(p_apos_id is null)) or (p_apos_data is not null and (p_apos_data<p_semana_inicio or p_apos_data>=p_semana_inicio+7)) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select a.id,a.funcionario_id,a.data,a.hora_inicio,a.hora_fim from pcm.agenda_tecnico a
 where a.cliente_id=p_cliente_id and a.deleted_at is null and a.data>=p_semana_inicio and a.data<p_semana_inicio+7
   and (p_apos_data is null or (a.data,a.id)>(p_apos_data,p_apos_id)) order by a.data,a.id limit p_limite;
end; $$;
