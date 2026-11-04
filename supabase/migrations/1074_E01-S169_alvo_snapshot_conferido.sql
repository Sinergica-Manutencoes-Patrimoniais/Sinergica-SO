-- ADR-0889: valida vínculo histórico antes de liberar cada página.
create function pcm.sso_snapshot_exportacao_conferido(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_posicao integer,p_limite integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb; v_snapshot jsonb;
begin
  v_resultado:=pcm.sso_snapshot_exportacao_plano(p_cliente_id,p_plano_id,p_versao_id,p_posicao,p_limite);
  -- O núcleo já travou a linha da versão até o fim da transação.
  select snapshot into v_snapshot from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id;
  if exists (select 1 from jsonb_array_elements(v_snapshot->'rotinas') x(item)
    where num_nonnulls(x.item->>'sistema_id',x.item->>'equipamento_id',x.item->>'grupo_id') <> 1
      or x.item->'alvo'->>'id' is distinct from case x.item->>'alvo_tipo'
        when 'sistema' then x.item->>'sistema_id'
        when 'componente' then x.item->>'equipamento_id'
        when 'grupo' then x.item->>'grupo_id'
        else null end) then
    raise exception 'vinculo_alvo_snapshot_invalido' using errcode='23514';
  end if;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_snapshot_exportacao_conferido(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_snapshot_exportacao_conferido(uuid,uuid,uuid,integer,integer) to authenticated;
revoke execute on function pcm.sso_snapshot_exportacao_plano(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
