-- ADR-1650: leitura preparada; gate desligado e nenhuma escrita operacional.
create table pcm.sso_planos_por_alvo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_planos_por_alvo_gate(id,habilitado) values(true,false);
alter table pcm.sso_planos_por_alvo_gate enable row level security;
alter table pcm.sso_planos_por_alvo_gate force row level security;
revoke all on pcm.sso_planos_por_alvo_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_planos_por_alvo(
  p_ator uuid,p_cliente uuid,p_tipo text,p_alvo uuid,
  p_apos_plano uuid,p_apos_versao uuid,p_apos_rotina uuid,p_limite integer
) returns table(plano_id uuid,plano_nome text,plano_estado text,versao_id uuid,versao_numero integer,
  versao_estado text,vigencia_inicio date,vigencia_fim date,rotina_id uuid,rotina_nome text)
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_alvo is null
    or p_tipo is null or p_tipo not in ('sistema','componente','grupo') or p_limite is null or p_limite not between 1 and 50
    or num_nonnulls(p_apos_plano,p_apos_versao,p_apos_rotina) not in (0,3) then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.sso_planos_por_alvo_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'consulta_planos_por_alvo_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente) is not true or
    (config.sso_autorizar_acao('cadastro.ler',p_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is not true) or
    not ((p_tipo='sistema' and exists(select 1 from pcm.sistemas s where s.id=p_alvo and s.cliente_id=p_cliente and s.deleted_at is null))
      or (p_tipo='componente' and exists(select 1 from pcm.equipamentos e where e.id=p_alvo and e.client_id=p_cliente and e.deleted_at is null))
      or (p_tipo='grupo' and exists(select 1 from pcm.grupos_quantitativos g where g.id=p_alvo and g.cliente_id=p_cliente and g.deleted_at is null))) then
    raise exception 'alvo_nao_encontrado_ou_sem_acesso' using errcode='42501';
  end if;
  if exists(select 1 from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id
    where p.cliente_id=p_cliente and v.estado='aprovado' and
      case when jsonb_typeof(v.snapshot->'rotinas')='array' then jsonb_array_length(v.snapshot->'rotinas')=0 else true end) then
    raise exception 'snapshot_historico_indisponivel' using errcode='23514';
  end if;
  if exists(select 1 from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id
    cross join lateral jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array'
      then v.snapshot->'rotinas' else '[]'::jsonb end) j(item)
    where p.cliente_id=p_cliente and v.estado='aprovado' and (
      jsonb_typeof(j.item) is distinct from 'object'
      or coalesce(j.item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(j.item->'nome') is distinct from 'string' or length(btrim(j.item->>'nome'))=0
      or coalesce(j.item->>'alvo_tipo','') not in ('sistema','componente','grupo')
      or coalesce(case j.item->>'alvo_tipo' when 'sistema' then j.item->>'sistema_id'
        when 'componente' then j.item->>'equipamento_id' when 'grupo' then j.item->>'grupo_id' end,'')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) then
    raise exception 'snapshot_historico_invalido' using errcode='23514';
  end if;
  return query
    with vinculos as (
      select p.id as plano_id,p.nome as plano_nome,p.estado as plano_estado,v.id as versao_id,v.numero as versao_numero,
        v.estado as versao_estado,v.vigencia_inicio,v.vigencia_fim,r.id as rotina_id,r.nome as rotina_nome
      from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id and v.estado='rascunho'
      join pcm.rotinas_manutencao r on r.plano_id=p.id and r.versao_id=v.id
      where p.cliente_id=p_cliente and r.alvo_tipo=p_tipo and
        case p_tipo when 'sistema' then r.sistema_id when 'componente' then r.equipamento_id else r.grupo_id end=p_alvo
      union all
      select p.id,p.nome,p.estado,v.id,v.numero,v.estado,v.vigencia_inicio,v.vigencia_fim,r.id::uuid,r.nome
      from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id and v.estado='aprovado'
      cross join lateral jsonb_to_recordset(v.snapshot->'rotinas') as r(id text,nome text,alvo_tipo text,sistema_id text,equipamento_id text,grupo_id text)
      where p.cliente_id=p_cliente and r.alvo_tipo=p_tipo and
        lower(case p_tipo when 'sistema' then r.sistema_id when 'componente' then r.equipamento_id else r.grupo_id end)=p_alvo::text
    )
    select x.plano_id,x.plano_nome,x.plano_estado,x.versao_id,x.versao_numero,x.versao_estado,
      x.vigencia_inicio,x.vigencia_fim,x.rotina_id,x.rotina_nome from vinculos x
    where p_apos_plano is null or (x.plano_id,x.versao_id,x.rotina_id)>(p_apos_plano,p_apos_versao,p_apos_rotina)
    order by x.plano_id,x.versao_id,x.rotina_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_planos_por_alvo(uuid,uuid,text,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_planos_por_alvo(uuid,uuid,text,uuid,uuid,uuid,uuid,integer) to authenticated;
