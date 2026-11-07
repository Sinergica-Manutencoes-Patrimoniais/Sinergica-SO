-- ADR-0047: prévia informativa, nunca aprovação nem validação transacional.
create function pcm.sso_conferir_rotinas_plano(p_plano_id uuid, p_limite integer, p_apos uuid)
returns table(rotina_id uuid, revisao integer, pendencias text[])
language plpgsql stable security definer set search_path = '' as $$
declare v_plano pcm.planos_manutencao%rowtype;
begin
  if p_plano_id is null or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  select * into v_plano from pcm.planos_manutencao where id = p_plano_id;
  if not found or not config.sso_autorizar_acao('plano.gerir', v_plano.cliente_id) then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  return query
  select r.id, v_plano.revisao, array_remove(array[
    case when r.intervalo_n is null then 'recorrencia' end,
    case when r.modo = 'calendario' and r.data_base is null then 'data_base' end,
    case when nullif(btrim(r.instrucao), '') is null and r.questionario_id is null then 'instrucao_ou_questionario' end,
    case when coalesce(r.tempo_minutos, 0) = 0 then 'tempo_a_validar' end,
    case when r.tempo_minutos > 0 and r.tipo_tempo is null then 'tipo_tempo' end,
    case when (r.alvo_tipo = 'sistema' and not coalesce(s.ativo and s.deleted_at is null, false))
      or (r.alvo_tipo = 'componente' and not coalesce(e.ativo and e.deleted_at is null, false))
      or (r.alvo_tipo = 'grupo' and not coalesce(g.ativo and g.deleted_at is null, false)) then 'alvo_indisponivel' end,
    case when r.questionario_id is not null and not coalesce(q.ativo, false) then 'questionario_indisponivel' end
  ]::text[], null)
  from pcm.rotinas_manutencao r
  join pcm.plano_versoes v on v.id = r.versao_id and v.plano_id = p_plano_id and v.estado = 'rascunho'
  left join pcm.sistemas s on s.id = r.sistema_id and s.cliente_id = v_plano.cliente_id
  left join pcm.equipamentos e on e.id = r.equipamento_id and e.client_id = v_plano.cliente_id
  left join pcm.grupos_quantitativos g on g.id = r.grupo_id and g.cliente_id = v_plano.cliente_id
  left join pcm.questionarios q on q.id = r.questionario_id
  where r.plano_id = p_plano_id and (p_apos is null or r.id > p_apos)
  order by r.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_conferir_rotinas_plano(uuid, integer, uuid) from public, anon;
grant execute on function pcm.sso_conferir_rotinas_plano(uuid, integer, uuid) to authenticated;
