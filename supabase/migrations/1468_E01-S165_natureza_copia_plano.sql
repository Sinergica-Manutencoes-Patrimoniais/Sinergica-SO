-- ADR-1320: ao copiar Plano no mesmo Cliente, preservar apenas natureza
-- explícita da fotografia de origem e somente no mesmo alvo do registro.
create function pcm.sso_copiar_natureza_plano() returns trigger
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_snapshot jsonb;v_mapa jsonb;v_item jsonb;v_origens jsonb;v_origem jsonb;
  v_destino uuid;v_alvo uuid;v_natureza text;
begin
  perform 1 from pcm.sso_natureza_alvo_rotina_gate where id and habilitado for share;
  if not found then return new; end if;
  select v.snapshot into v_snapshot from pcm.plano_versoes v
    join pcm.planos_manutencao p on p.id=v.plano_id and p.cliente_id=new.cliente_id
    where v.id=new.origem_versao_id and v.plano_id=new.origem_plano_id and v.estado='aprovado' for share of v,p;
  if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array'
    or encode(sha256(convert_to(v_snapshot::text,'UTF8')),'hex') is distinct from new.snapshot_sha256
    then raise exception 'snapshot_natureza_indisponivel' using errcode='23514'; end if;
  v_mapa:=new.resultado->'rotinas';
  if jsonb_typeof(v_mapa) is distinct from 'array'
    or jsonb_array_length(v_mapa)<>jsonb_array_length(v_snapshot->'rotinas')
    then raise exception 'mapa_natureza_invalido' using errcode='23514'; end if;
  for v_item in select value from jsonb_array_elements(v_mapa) loop
    select jsonb_agg(r) into v_origens from jsonb_array_elements(v_snapshot->'rotinas') r
      where r->>'id'=v_item->>'origemRotinaId';
    if v_origens is null or jsonb_array_length(v_origens)<>1 then raise exception 'origem_natureza_ambigua' using errcode='23514'; end if;
    v_origem:=v_origens->0;
    v_natureza:=v_origem->>'natureza_tecnica';
    if v_natureza is null then continue; end if;
    if v_origem->>'alvo_tipo' is distinct from 'componente' or v_natureza not in ('equipamento','componente')
      then raise exception 'natureza_historica_invalida' using errcode='23514'; end if;
    v_destino:=(v_item->>'rotinaId')::uuid;v_alvo:=(v_origem->>'equipamento_id')::uuid;
    if v_destino is null or v_alvo is null then raise exception 'mapa_natureza_invalido' using errcode='23514'; end if;
    update pcm.rotinas_manutencao r set natureza_tecnica=v_natureza
      where r.id=v_destino and r.plano_id=new.destino_plano_id and r.versao_id=new.destino_versao_id
        and r.alvo_tipo='componente' and r.equipamento_id=v_alvo and r.natureza_tecnica is null;
    if not found then raise exception 'destino_natureza_divergente' using errcode='23514'; end if;
  end loop;
  return new;
end; $$;
revoke all on function pcm.sso_copiar_natureza_plano() from public,anon,authenticated,service_role;
create trigger sso_copiar_natureza_plano after insert on pcm.sso_copias_plano
for each row execute function pcm.sso_copiar_natureza_plano();
