-- ADR-0070: leituras contextuais com limite e sem efeito operacional.
create function pcm.sso_listar_visitas(
  p_cliente_id uuid, p_inicio timestamptz, p_fim timestamptz, p_limite integer,
  p_apos_inicio timestamptz, p_apos_id uuid
) returns table(id uuid, cliente_id uuid, inicio_em timestamptz, fim_em timestamptz, fuso text,
  natureza text, estado text, revisao integer, responsavel_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim)
    or p_fim <= p_inicio or p_limite is null or p_limite < 1 or p_limite > 100
    or ((p_apos_inicio is null) <> (p_apos_id is null))
    or (p_apos_inicio is not null and not isfinite(p_apos_inicio)) then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id) then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query select v.id, v.cliente_id, v.inicio_em, v.fim_em, v.fuso, v.natureza, v.estado, v.revisao, v.responsavel_id
    from pcm.visitas v where v.cliente_id = p_cliente_id and v.inicio_em >= p_inicio and v.inicio_em < p_fim
      and (p_apos_inicio is null or (v.inicio_em, v.id) > (p_apos_inicio, p_apos_id))
    order by v.inicio_em, v.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_visitas(uuid, timestamptz, timestamptz, integer, timestamptz, uuid) from public, anon;
grant execute on function pcm.sso_listar_visitas(uuid, timestamptz, timestamptz, integer, timestamptz, uuid) to authenticated;

create function pcm.sso_detalhar_visita(p_cliente_id uuid, p_visita_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_visita pcm.visitas%rowtype;
begin
  if p_cliente_id is null or p_visita_id is null then raise exception 'consulta_invalida' using errcode = '22023'; end if;
  if not config.sso_autorizar_acao('visita.confirmar', p_cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_visita from pcm.visitas where id = p_visita_id and cliente_id = p_cliente_id;
  if not found then raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return jsonb_build_object('id', v_visita.id, 'clienteId', v_visita.cliente_id, 'contratoId', v_visita.contrato_id,
    'areaId', v_visita.area_id, 'localId', v_visita.local_id, 'inicioEm', v_visita.inicio_em, 'fimEm', v_visita.fim_em,
    'fuso', v_visita.fuso, 'natureza', v_visita.natureza, 'estado', v_visita.estado, 'responsavelId', v_visita.responsavel_id,
    'deslocamentoMinutos', v_visita.deslocamento_minutos, 'revisao', v_visita.revisao,
    'quantidadeOs', (select count(*) from pcm.visita_ordens_servico o where o.visita_id = p_visita_id and o.encerrado_em is null),
    'quantidadeEquipe', (select count(*) from pcm.visita_equipes e where e.visita_id = p_visita_id and e.encerrado_em is null));
end;
$$;
revoke all on function pcm.sso_detalhar_visita(uuid, uuid) from public, anon;
grant execute on function pcm.sso_detalhar_visita(uuid, uuid) to authenticated;
