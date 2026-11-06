-- ADR-0422: projeção agregada, somente leitura, sem processar outbox.
create table pcm.visita_diagnostico_sync_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.visita_diagnostico_sync_gate(id,habilitado) values(true,false);
alter table pcm.visita_diagnostico_sync_gate enable row level security;
alter table pcm.visita_diagnostico_sync_gate force row level security;
revoke all on pcm.visita_diagnostico_sync_gate from public,anon,authenticated,service_role;

create function pcm.sso_diagnostico_sincronizacao_visita(p_cliente_id uuid,p_visita_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_os integer; v_sem_tarefa integer; v_os_pendentes integer; v_os_erro integer; v_equipe integer; v_fila_pendente integer; v_fila_processando integer; v_fila_erro integer;
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from pcm.visita_diagnostico_sync_gate where id),false)
    or not exists(select 1 from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  select count(*),count(*) filter(where o.auvo_task_id is null),
    count(*) filter(where o.auvo_sync_status in ('pending','opening')),
    count(*) filter(where o.auvo_sync_status='error')
    into v_os,v_sem_tarefa,v_os_pendentes,v_os_erro
    from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id
    where vo.visita_id=p_visita_id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null;
  select count(distinct funcionario_id) into v_equipe from pcm.visita_equipes
    where visita_id=p_visita_id and cliente_id=p_cliente_id and encerrado_em is null;
  if v_os>100 or v_equipe>100 then raise exception 'composicao_excede_limite' using errcode='54000'; end if;
  select count(*) filter(where q.status='pending'),count(*) filter(where q.status='processing'),count(*) filter(where q.status='error')
    into v_fila_pendente,v_fila_processando,v_fila_erro from pcm.auvo_sync_outbox q
    where q.entity='funcionarios' and q.status in ('pending','processing','error') and exists(
      select 1 from pcm.visita_equipes ve where ve.visita_id=p_visita_id and ve.cliente_id=p_cliente_id
        and ve.encerrado_em is null and ve.funcionario_id=q.row_id);
  return jsonb_build_object('visitaId',p_visita_id,'os',jsonb_build_object('total',v_os,'semTarefaLocal',v_sem_tarefa,'estadoPendente',v_os_pendentes,'estadoErro',v_os_erro),
    'equipe',jsonb_build_object('total',v_equipe,'itensFilaPendentes',v_fila_pendente,'itensFilaProcessando',v_fila_processando,'itensFilaErro',v_fila_erro),
    'situacaoRemota','desconhecida','autorizaEnvio',false);
end $$;
revoke all on function pcm.sso_diagnostico_sincronizacao_visita(uuid,uuid) from public,anon,authenticated,service_role;
