-- DEF-03: horários agendados no Auvo e já sincronizados nas OS vigentes da Visita.
-- Reverso após reverter o frontend:
--   drop function if exists pcm.sso_listar_agenda_tecnico_com_horarios_auvo(uuid, date, integer);

do $migration$
begin
  create function pcm.sso_listar_agenda_tecnico_com_horarios_auvo(
    p_cliente_id uuid, p_semana_inicio date, p_limite integer
  ) returns table(
    visita_id uuid, cliente_id uuid, cliente_nome text,
    funcionario_id uuid, funcionario_nome text, papel text,
    data date, periodo text, inicio_em timestamptz, fim_em timestamptz,
    estado text, natureza text, os_numeros text[], quantidade_os integer,
    horarios_auvo text[]
  ) language sql volatile security definer set search_path = '' as $$
    select agenda.*,
           array(
             select distinct pg_catalog.to_char(os.data_agendada at time zone v.fuso, 'HH24:MI')
               from pcm.visitas v
               join pcm.visita_ordens_servico vo
                 on vo.visita_id = v.id and vo.cliente_id = v.cliente_id and vo.encerrado_em is null
               join pcm.ordens_servico os
                 on os.id = vo.os_id and os.client_id = vo.cliente_id and os.deleted_at is null
              where v.id = agenda.visita_id and v.cliente_id = agenda.cliente_id
                and os.auvo_task_id is not null and pg_catalog.isfinite(os.data_agendada)
              order by 1
           )
      from pcm.sso_listar_agenda_tecnico_projetada(p_cliente_id, p_semana_inicio, p_limite) agenda;
  $$;

  revoke all on function pcm.sso_listar_agenda_tecnico_com_horarios_auvo(uuid, date, integer)
    from public, anon, authenticated, service_role;
  grant execute on function pcm.sso_listar_agenda_tecnico_com_horarios_auvo(uuid, date, integer)
    to authenticated;
end;
$migration$;
