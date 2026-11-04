-- ADR-0049: versões aprovadas são lidas somente do snapshot.
create or replace function pcm.sso_listar_rotinas_plano(p_plano_id uuid, p_versao_id uuid, p_limite integer, p_apos uuid)
returns table(id uuid, plano_id uuid, versao_id uuid, nome text, alvo_tipo text, sistema_id uuid, equipamento_id uuid,
  grupo_id uuid, modo text, intervalo_n integer, intervalo_unidade text, data_base date, tempo_minutos integer,
  tipo_tempo text, tolerancia_antes integer, tolerancia_depois integer, instrucao text, questionario_id uuid,
  alvo_nome text, alvo_ativo boolean, questionario_nome text)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_versao pcm.plano_versoes%rowtype;
begin
  if p_plano_id is null or p_versao_id is null or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'consulta_invalida' using errcode = '22023';
  end if;
  select p.cliente_id into v_cliente from pcm.planos_manutencao p where p.id = p_plano_id;
  if v_cliente is null or not config.sso_autorizar_acao('plano.gerir', v_cliente) then
    raise exception 'plano_ou_versao_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  select * into v_versao from pcm.plano_versoes v where v.id = p_versao_id and v.plano_id = p_plano_id;
  if not found then raise exception 'plano_ou_versao_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if v_versao.estado = 'aprovado' then
    if jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array'
      or jsonb_array_length(v_versao.snapshot->'rotinas') = 0 then
      raise exception 'snapshot_historico_indisponivel' using errcode = '23514';
    end if;
    return query select r.id, p_plano_id, p_versao_id, r.nome, r.alvo_tipo, r.sistema_id, r.equipamento_id,
      r.grupo_id, r.modo, r.intervalo_n, r.intervalo_unidade, r.data_base, r.tempo_minutos,
      r.tipo_tempo, r.tolerancia_antes, r.tolerancia_depois, r.instrucao, r.questionario_id,
      r.alvo->>'nome', true, r.questionario->>'nome'
    from jsonb_to_recordset(v_versao.snapshot->'rotinas') as r(
      id uuid, nome text, alvo_tipo text, sistema_id uuid, equipamento_id uuid, grupo_id uuid, modo text,
      intervalo_n integer, intervalo_unidade text, data_base date, tempo_minutos integer, tipo_tempo text,
      tolerancia_antes integer, tolerancia_depois integer, instrucao text, questionario_id uuid, alvo jsonb, questionario jsonb)
    where p_apos is null or r.id > p_apos order by r.id limit p_limite;
    return;
  end if;
  return query select r.id, r.plano_id, r.versao_id, r.nome, r.alvo_tipo, r.sistema_id, r.equipamento_id, r.grupo_id,
    r.modo, r.intervalo_n, r.intervalo_unidade, r.data_base, r.tempo_minutos, r.tipo_tempo,
    r.tolerancia_antes, r.tolerancia_depois, r.instrucao, r.questionario_id,
    case r.alvo_tipo when 'sistema' then s.nome when 'componente' then e.nome else g.nome end,
    case r.alvo_tipo when 'sistema' then coalesce(s.ativo and s.deleted_at is null, false)
      when 'componente' then coalesce(e.ativo and e.deleted_at is null, false) else coalesce(g.ativo and g.deleted_at is null, false) end,
    q.nome
  from pcm.rotinas_manutencao r
  left join pcm.sistemas s on s.id = r.sistema_id and s.cliente_id = v_cliente
  left join pcm.equipamentos e on e.id = r.equipamento_id and e.client_id = v_cliente
  left join pcm.grupos_quantitativos g on g.id = r.grupo_id and g.cliente_id = v_cliente
  left join pcm.questionarios q on q.id = r.questionario_id
  where r.plano_id = p_plano_id and r.versao_id = p_versao_id and (p_apos is null or r.id > p_apos)
  order by r.id limit p_limite;
end;
$$;
