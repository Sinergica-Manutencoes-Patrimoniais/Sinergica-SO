-- ADR-1057: leitura mínima; não movimenta OS e não chama Auvo.
create table pcm.sso_triagem_intencoes_os_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_triagem_intencoes_os_gate(id,habilitado) values(true,false);
alter table pcm.sso_triagem_intencoes_os_gate enable row level security;
alter table pcm.sso_triagem_intencoes_os_gate force row level security;
revoke all on pcm.sso_triagem_intencoes_os_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_intencoes_reprogramacao_triagem(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(intencao_id uuid,os_id uuid,visita_origem_id uuid,visita_destino_id uuid,tarefa_auvo_id text,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_triagem_intencoes_os_gate where id and habilitado for share;
  if not found then raise exception 'triagem_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
  if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  perform 1 from pcm.reprogramacao_os_enviada_gate where id and habilitado for share;
  if not found then raise exception 'fonte_indisponivel' using errcode='55000'; end if;
  if config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true or
    config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select i.id,i.os_id,i.visita_origem_id,i.visita_destino_id,i.tarefa_auvo_id::text,i.criado_em
    from pcm.reprogramacao_os_intencoes i
    join pcm.ordens_servico os on os.id=i.os_id and os.client_id=i.cliente_id and os.deleted_at is null
    join pcm.visitas vo on vo.id=i.visita_origem_id and vo.cliente_id=i.cliente_id
    join pcm.visitas vd on vd.id=i.visita_destino_id and vd.cliente_id=i.cliente_id
    where i.cliente_id=p_cliente_id and i.estado='pendente' and (p_apos is null or i.id>p_apos)
    order by i.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_intencoes_reprogramacao_triagem(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_intencoes_reprogramacao_triagem(uuid,uuid,uuid,integer) to authenticated;
