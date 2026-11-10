-- ADR-1347: extensão aditiva de leitura; preserva gate e contrato anteriores.
create function pcm.sso_listar_fila_preventiva_pcm_v2(
  p_cliente_id uuid, p_plano_id uuid, p_apos uuid, p_limite integer
) returns table (
  ciclo_id uuid, preparada_id uuid, estado text, revisao integer, vencimento date,
  atualizado_em timestamptz, rotina_id uuid, rotina_nome text, alvo_tipo text, alvo_id uuid
) language sql volatile security definer set search_path = '' as $$
  select f.ciclo_id, f.preparada_id, f.estado, f.revisao, f.vencimento, f.atualizado_em,
    o.rotina_id, r.nome, o.alvo_tipo, o.alvo_id
  from pcm.sso_listar_fila_preventiva_pcm(p_cliente_id, p_plano_id, p_apos, p_limite) f
  left join pcm.ocorrencias_rotina_preparadas o on o.id = f.preparada_id and o.plano_id = p_plano_id
  left join pcm.rotinas_manutencao r on r.id = o.rotina_id and r.plano_id = o.plano_id and r.versao_id = o.versao_id
  order by f.ciclo_id;
$$;
revoke all on function pcm.sso_listar_fila_preventiva_pcm_v2(uuid, uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_fila_preventiva_pcm_v2(uuid, uuid, uuid, integer) to authenticated;
