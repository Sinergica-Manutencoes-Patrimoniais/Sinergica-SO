-- ADR-1355: projeção aditiva; autorização e gate são aplicados pela lista v2.
create function pcm.sso_listar_fila_preventiva_pcm_v3(
  p_cliente_id uuid, p_plano_id uuid, p_apos uuid, p_limite integer
) returns table (
  ciclo_id uuid, preparada_id uuid, estado text, revisao integer, vencimento date,
  atualizado_em timestamptz, rotina_id uuid, rotina_nome text, alvo_tipo text, alvo_id uuid,
  versao_origem_id uuid, ciclo_indice integer
) language sql volatile security definer set search_path = '' as $$
  select f.ciclo_id, f.preparada_id, f.estado, f.revisao, f.vencimento, f.atualizado_em,
    f.rotina_id, f.rotina_nome, f.alvo_tipo, f.alvo_id, o.versao_id, c.indice
  from pcm.sso_listar_fila_preventiva_pcm_v2(p_cliente_id, p_plano_id, p_apos, p_limite) f
  left join pcm.ocorrencias_rotina_preparadas o on o.id = f.preparada_id and o.plano_id = p_plano_id
    and o.rotina_id = f.rotina_id and o.vencimento_original = f.vencimento
  left join pcm.sso_ciclos_calendario_canonicos c on c.id = f.ciclo_id
    and c.vencimento_original = f.vencimento and c.indice = o.ciclo
  order by f.ciclo_id;
$$;
revoke all on function pcm.sso_listar_fila_preventiva_pcm_v3(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fila_preventiva_pcm_v3(uuid,uuid,uuid,integer) to authenticated;
