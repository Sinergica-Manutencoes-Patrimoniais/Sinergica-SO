-- ADR-0143: consulta privada preparada, sem concessão operacional.
create function pcm.sso_consultar_decisao_linha_levantamento(p_lote_id uuid, p_chave text)
returns table(decisao text, revisao integer, motivo text, tipo text, entidade_id uuid, ator_id uuid, ocorrido_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid;
begin
  if p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  select cliente_id into v_cliente from pcm.sso_levantamentos where id = p_lote_id;
  if not found or config.sso_autorizar_acao('cadastro.aprovar', v_cliente) is not true then
    raise exception 'levantamento_nao_encontrado_ou_sem_acesso' using errcode = '42501';
  end if;
  if not exists (select 1 from pcm.sso_levantamento_linhas l where l.lote_id = p_lote_id and l.chave = p_chave) then
    raise exception 'linha_nao_encontrada' using errcode = '23514';
  end if;
  return query
    select 'rejeitada'::text, r.revisao, r.motivo, null::text, null::uuid, r.ator_id, r.ocorrido_em
      from pcm.sso_levantamento_rejeicoes r where r.lote_id = p_lote_id and r.linha_chave = p_chave
    union all
    select 'incorporada'::text, i.revisao, null::text, i.tipo, i.entidade_id, i.ator_id, i.ocorrido_em
      from pcm.sso_levantamento_incorporacoes i where i.lote_id = p_lote_id and i.linha_chave = p_chave;
end;
$$;
revoke all on function pcm.sso_consultar_decisao_linha_levantamento(uuid,text)
  from public, anon, authenticated, service_role;
