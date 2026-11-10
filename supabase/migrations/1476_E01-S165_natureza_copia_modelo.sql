-- ADR-1326: preserva natureza explícita somente para o mesmo alvo e Cliente.
create function pcm.sso_copiar_natureza_rotina_modelo() returns trigger
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_snapshot jsonb; v_itens jsonb; v_item jsonb; v_natureza text; v_alvo uuid;
begin
  if new.origem_cliente_id is distinct from new.destino_cliente_id then return new; end if;
  perform 1 from pcm.sso_natureza_alvo_rotina_gate where id and habilitado for share;
  if not found then return new; end if;
  select v.snapshot into v_snapshot from pcm.plano_versoes v
    join pcm.planos_manutencao p on p.id=v.plano_id and p.cliente_id=new.origem_cliente_id
    where v.id=new.origem_versao_id and v.plano_id=new.origem_plano_id and v.estado='aprovado'
    for share of v,p;
  if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then
    raise exception 'snapshot_natureza_indisponivel' using errcode='23514';
  end if;
  select jsonb_agg(r) into v_itens from jsonb_array_elements(v_snapshot->'rotinas') r
    where r->>'id'=new.origem_rotina_id::text;
  if v_itens is null or jsonb_array_length(v_itens)<>1 then
    raise exception 'origem_natureza_ambigua' using errcode='23514';
  end if;
  v_item:=v_itens->0;
  if encode(sha256(convert_to(v_item::text,'UTF8')),'hex') is distinct from new.snapshot_sha256 then
    raise exception 'snapshot_natureza_divergente' using errcode='23514';
  end if;
  v_natureza:=v_item->>'natureza_tecnica';
  if v_natureza is null then return new; end if;
  if v_item->>'alvo_tipo' is distinct from 'componente' or v_natureza not in ('equipamento','componente') then
    raise exception 'natureza_historica_invalida' using errcode='23514';
  end if;
  v_alvo:=(v_item->>'equipamento_id')::uuid;
  if v_alvo is null then raise exception 'alvo_historico_invalido' using errcode='23514'; end if;
  if new.payload->>'alvoTipo' is distinct from 'componente' or new.payload->>'alvoId' is distinct from v_alvo::text then return new; end if;
  update pcm.rotinas_manutencao r set natureza_tecnica=v_natureza
    from pcm.plano_versoes v, pcm.planos_manutencao p
    where r.id=new.destino_rotina_id and r.plano_id=new.destino_plano_id
      and p.id=r.plano_id and p.cliente_id=new.destino_cliente_id and p.estado='rascunho'
      and v.id=r.versao_id and v.plano_id=p.id and v.estado='rascunho'
      and r.alvo_tipo='componente' and r.equipamento_id=v_alvo and r.natureza_tecnica is null;
  if not found then raise exception 'destino_natureza_divergente' using errcode='23514'; end if;
  return new;
end; $$;
revoke all on function pcm.sso_copiar_natureza_rotina_modelo() from public,anon,authenticated,service_role;
create trigger sso_copiar_natureza_rotina_modelo after insert on pcm.sso_copias_rotina_modelo
for each row execute function pcm.sso_copiar_natureza_rotina_modelo();
