-- ADR-0357: diagnóstico, nunca resolve condição técnica.
create table pcm.sso_diagnostico_resolucao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_resolucao_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_resolucao_gate enable row level security;alter table pcm.sso_diagnostico_resolucao_gate force row level security;
revoke all on pcm.sso_diagnostico_resolucao_gate from public,anon,authenticated,service_role;
create function pcm.sso_diagnostico_resolucao_pendencia(p_pendencia_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype;v_parcela boolean;v_os boolean;v_finalizada boolean;
begin
  if not coalesce((select habilitado from pcm.sso_diagnostico_resolucao_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_pendencia_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select exists(select 1 from pcm.sso_backlog_parcelas b where b.pendencia_id=v_p.id and b.cliente_id=v_p.cliente_id) into v_parcela;
  select exists(select 1 from pcm.sso_backlog_parcelas b join pcm.sso_atribuicoes_parcela a on a.parcela_id=b.parcela_id and a.cliente_id=b.cliente_id and a.chamado_id=b.chamado_id join pcm.ordens_servico o on o.id=a.os_id and o.client_id=b.cliente_id and o.chamado_id=b.chamado_id and o.deleted_at is null where b.pendencia_id=v_p.id and b.cliente_id=v_p.cliente_id),
    exists(select 1 from pcm.sso_backlog_parcelas b join pcm.sso_atribuicoes_parcela a on a.parcela_id=b.parcela_id and a.cliente_id=b.cliente_id and a.chamado_id=b.chamado_id join pcm.ordens_servico o on o.id=a.os_id and o.client_id=b.cliente_id and o.chamado_id=b.chamado_id and o.deleted_at is null and o.status='finalizado' where b.pendencia_id=v_p.id and b.cliente_id=v_p.cliente_id)
    into v_os,v_finalizada;
  return jsonb_build_object('pendenciaId',v_p.id,'revision',v_p.revisao,'estado',v_p.estado,'parcelaVinculada',v_parcela,'osAtribuida',v_os,'osFinalizada',v_finalizada);
end;
$$;
revoke all on function pcm.sso_diagnostico_resolucao_pendencia(uuid) from public,anon,authenticated,service_role;
