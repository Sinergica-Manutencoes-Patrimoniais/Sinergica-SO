-- ADR-1320: projeção aditiva da natureza preservada na fotografia aprovada.
create function pcm.sso_snapshot_exportacao_natureza(
  p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_posicao integer,p_limite integer
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_pagina jsonb;v_snapshot jsonb;v_itens jsonb;v_item jsonb;v_origens jsonb;v_origem jsonb;
  v_natureza text;v_resultado jsonb:='[]'::jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.sso_natureza_alvo_rotina_gate where id and habilitado for share;
  if not found then raise exception 'natureza_desabilitada' using errcode='55000'; end if;
  v_pagina:=pcm.sso_snapshot_exportacao_conferido(p_cliente_id,p_plano_id,p_versao_id,p_posicao,p_limite);
  select v.snapshot into v_snapshot from pcm.plano_versoes v where v.id=p_versao_id and v.plano_id=p_plano_id and v.estado='aprovado' for share;
  if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array'
    or pg_catalog.md5(v_snapshot::text) is distinct from v_pagina->>'snapshotHash'
    then raise exception 'snapshot_divergente' using errcode='23514'; end if;
  v_itens:=v_pagina->'rotinas';
  if jsonb_typeof(v_itens) is distinct from 'array' then raise exception 'pagina_invalida' using errcode='23514'; end if;
  for v_item in select value from jsonb_array_elements(v_itens) loop
    select jsonb_agg(r) into v_origens from jsonb_array_elements(v_snapshot->'rotinas') r
      where r->>'id'=v_item->>'id';
    if v_origens is null or jsonb_array_length(v_origens)<>1 then raise exception 'rotina_historica_invalida' using errcode='23514'; end if;
    v_origem:=v_origens->0;v_natureza:=v_origem->>'natureza_tecnica';
    if v_natureza is not null and (v_natureza not in ('equipamento','componente') or v_item->>'alvoTipo'<>'componente')
      then raise exception 'natureza_historica_invalida' using errcode='23514'; end if;
    v_resultado:=v_resultado||jsonb_build_array(v_item||jsonb_build_object('alvoNatureza',v_natureza));
  end loop;
  return jsonb_set(v_pagina,'{rotinas}',v_resultado,false);
end; $$;
revoke all on function pcm.sso_snapshot_exportacao_natureza(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_snapshot_exportacao_natureza(uuid,uuid,uuid,uuid,integer,integer) to authenticated;
