-- ADR-0221: diagnóstico local sem somar, reservar ou alterar agenda.
create function pcm.sso_diagnosticar_conflitos_capacidade(p_disponibilidade_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_disp pcm.capacidade_disponibilidades%rowtype;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.capacidade_intervalo_gate where id),false) then raise exception 'intervalos_bloqueados' using errcode='55000'; end if;
  select * into v_disp from pcm.capacidade_disponibilidades where id=p_disponibilidade_id;
  if auth.uid() is null or not found or config.sso_autorizar_acao('capacidade.gerir',v_disp.cliente_id) is distinct from true then
    raise exception 'disponibilidade_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  with visitas as materialized (
    select distinct v.id,v.inicio_em,v.fim_em from pcm.visitas v join pcm.visita_equipes e
      on e.visita_id=v.id and e.cliente_id=v.cliente_id and e.encerrado_em is null
    where v.cliente_id=v_disp.cliente_id and e.funcionario_id=v_disp.funcionario_id
      and v.estado not in ('cancelada','concluida')
      and v.inicio_em<((v_disp.semana_inicio+7)::timestamp at time zone v.fuso)
      and v.fim_em>(v_disp.semana_inicio::timestamp at time zone v.fuso)
  ), intervalo_conflitos as materialized (
    select v.id visita_id,i.id intervalo_id,i.tipo from visitas v join pcm.capacidade_intervalos_declarados i
      on i.disponibilidade_id=v_disp.id and tstzrange(v.inicio_em,v.fim_em,'[)') && tstzrange(i.inicio,i.fim,'[)')
  ), visita_conflitos as materialized (
    select a.id visita_a,b.id visita_b from visitas a join visitas b on a.id<b.id
      and tstzrange(a.inicio_em,a.fim_em,'[)') && tstzrange(b.inicio_em,b.fim_em,'[)')
  )
  select jsonb_build_object('disponibilidadeId',v_disp.id,'revisao',v_disp.revisao,
    'intervalos',coalesce((select jsonb_agg(to_jsonb(l)) from (select * from intervalo_conflitos order by visita_id,intervalo_id limit 100) l),'[]'::jsonb),
    'visitas',coalesce((select jsonb_agg(to_jsonb(l)) from (select * from visita_conflitos order by visita_a,visita_b limit 100) l),'[]'::jsonb),
    'truncado',((select count(*) from intervalo_conflitos)>100 or (select count(*) from visita_conflitos)>100),
    'abrangencia','parcial_mesmo_cliente','provaDisponibilidade',false) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_diagnosticar_conflitos_capacidade(uuid) from public,anon,authenticated,service_role;
