-- ADR-1304: entrada mediada; não abre os gates dos comandos delegados.
create table pcm.sso_transferencia_visita_mediada_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_transferencia_visita_mediada_gate(id,habilitado) values(true,false);
alter table pcm.sso_transferencia_visita_mediada_gate enable row level security;
alter table pcm.sso_transferencia_visita_mediada_gate force row level security;
revoke all on pcm.sso_transferencia_visita_mediada_gate from public,anon,authenticated,service_role;

create function pcm.sso_transferir_os_visita_mediado(
  p_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_origem_id uuid,p_destino_id uuid,
  p_vinculo_id uuid,p_novo_vinculo_id uuid,p_revisao_origem integer,p_revisao_destino integer,
  p_sequencia integer,p_motivo text,p_confirmadas boolean
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null
    or p_request_id is null or p_origem_id is null or p_destino_id is null
    or p_origem_id=p_destino_id or p_confirmadas is null then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_transferencia_visita_mediada_gate where id and habilitado for share;
  if not found then raise exception 'transferencia_mediada_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.visitas where id=p_origem_id and cliente_id=p_cliente_id)
    or not exists(select 1 from pcm.visitas where id=p_destino_id and cliente_id=p_cliente_id) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  if p_confirmadas then
    v_resultado:=pcm.sso_transferir_os_confirmada_preparado(p_request_id,p_origem_id,p_destino_id,p_vinculo_id,
      p_novo_vinculo_id,p_revisao_origem,p_revisao_destino,p_sequencia,p_motivo);
  else
    v_resultado:=pcm.sso_transferir_os_visita_preparado(p_request_id,p_origem_id,p_destino_id,p_vinculo_id,
      p_novo_vinculo_id,p_revisao_origem,p_revisao_destino,p_sequencia,p_motivo);
  end if;
  perform id from pcm.visitas where id in (p_origem_id,p_destino_id) order by id for share;
  if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.visitas where id=p_origem_id and cliente_id=p_cliente_id)
    or not exists(select 1 from pcm.visitas where id=p_destino_id and cliente_id=p_cliente_id) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_transferir_os_visita_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_transferir_os_visita_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean) to authenticated;
