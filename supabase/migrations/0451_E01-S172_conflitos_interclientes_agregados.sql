-- ADR-0225: saída agregada sob concessão global explícita, sem dados do outro Cliente.
create function pcm.sso_diagnosticar_conflitos_interclientes(p_disponibilidade_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_disp pcm.capacidade_disponibilidades%rowtype;v_total bigint;
begin
  if not coalesce((select habilitado from pcm.capacidade_intervalo_gate where id),false) then raise exception 'intervalos_bloqueados' using errcode='55000'; end if;
  select * into v_disp from pcm.capacidade_disponibilidades where id=p_disponibilidade_id;
  if auth.uid() is null or not found or config.sso_autorizar_acao('capacidade.gerir',v_disp.cliente_id) is distinct from true
    or not exists(select 1 from config.sso_concessoes g where g.acao='capacidade.gerir' and g.ativa and g.cliente_id is null
      and (g.usuario_id=auth.uid() or (g.perfil_id is not null and exists(select 1 from config.sso_usuario_perfis up
        join config.sso_perfis p on p.id=up.perfil_id and p.ativo where up.usuario_id=auth.uid() and up.perfil_id=g.perfil_id and up.ativo)))) then
    raise exception 'disponibilidade_nao_encontrada_ou_sem_acesso' using errcode='42501'; end if;
  with janelas_locais as materialized (
    select v.inicio_em as inicio,v.fim_em as fim from pcm.visitas v join pcm.visita_equipes e
      on e.visita_id=v.id and e.cliente_id=v.cliente_id and e.encerrado_em is null
    where v.cliente_id=v_disp.cliente_id and e.funcionario_id=v_disp.funcionario_id and v.estado not in ('cancelada','concluida')
      and v.inicio_em<((v_disp.semana_inicio+7)::timestamp at time zone v.fuso)
      and v.fim_em>(v_disp.semana_inicio::timestamp at time zone v.fuso)
    union all select i.inicio,i.fim from pcm.capacidade_intervalos_declarados i where i.disponibilidade_id=v_disp.id
  ), externos as (
    select 'visita'::text as tipo,v.id from pcm.visitas v join pcm.visita_equipes e
      on e.visita_id=v.id and e.cliente_id=v.cliente_id and e.encerrado_em is null
    where v.cliente_id<>v_disp.cliente_id and e.funcionario_id=v_disp.funcionario_id and v.estado not in ('cancelada','concluida')
      and exists(select 1 from janelas_locais l where tstzrange(v.inicio_em,v.fim_em,'[)') && tstzrange(l.inicio,l.fim,'[)'))
    union select 'intervalo'::text,i.id from pcm.capacidade_intervalos_declarados i join pcm.capacidade_disponibilidades d on d.id=i.disponibilidade_id
    where d.cliente_id<>v_disp.cliente_id and d.funcionario_id=v_disp.funcionario_id
      and exists(select 1 from janelas_locais l where tstzrange(i.inicio,i.fim,'[)') && tstzrange(l.inicio,l.fim,'[)'))
  ) select count(*) into v_total from externos;
  return jsonb_build_object('disponibilidadeId',v_disp.id,'revisao',v_disp.revisao,'registrosExternosComConflito',v_total,
    'abrangencia','parcial_fontes_existentes','provaDisponibilidade',false,'dadosExternosExpostos',false);
end;
$$;
revoke all on function pcm.sso_diagnosticar_conflitos_interclientes(uuid) from public,anon,authenticated,service_role;
