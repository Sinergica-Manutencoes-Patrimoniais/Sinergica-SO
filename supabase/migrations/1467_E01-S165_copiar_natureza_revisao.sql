-- ADR-1320: copiar somente natureza explícita da última fotografia aprovada
-- da mesma Rotina lógica e do mesmo alvo. Nunca reclassificar legado.
create function pcm.sso_copiar_natureza_revisao_rotina() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_snapshot jsonb;v_origens jsonb;v_origem jsonb;v_natureza text;
begin
  if new.natureza_tecnica is not null or new.alvo_tipo<>'componente' then return new; end if;
  perform 1 from pcm.sso_natureza_alvo_rotina_gate where id and habilitado for share;
  if not found then return new; end if;
  select v.snapshot into v_snapshot from pcm.plano_versoes v
    where v.plano_id=new.plano_id and v.estado='aprovado'
    order by v.numero desc limit 1 for share;
  if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then return new; end if;
  select jsonb_agg(r) into v_origens from jsonb_array_elements(v_snapshot->'rotinas') r
    where r->>'rotina_logica_id'=new.rotina_logica_id::text;
  if v_origens is null then return new; end if;
  if jsonb_array_length(v_origens)<>1 then raise exception 'origem_natureza_ambigua' using errcode='23514'; end if;
  v_origem:=v_origens->0;
  if v_origem->>'alvo_tipo' is distinct from 'componente' or v_origem->>'equipamento_id' is distinct from new.equipamento_id::text then return new; end if;
  v_natureza:=v_origem->>'natureza_tecnica';
  if v_natureza is null then return new; end if;
  if v_natureza not in ('equipamento','componente') then raise exception 'natureza_historica_invalida' using errcode='23514'; end if;
  new.natureza_tecnica:=v_natureza;
  return new;
end; $$;
revoke all on function pcm.sso_copiar_natureza_revisao_rotina() from public,anon,authenticated,service_role;
create trigger sso_copiar_natureza_revisao_rotina before insert on pcm.rotinas_manutencao
for each row execute function pcm.sso_copiar_natureza_revisao_rotina();
