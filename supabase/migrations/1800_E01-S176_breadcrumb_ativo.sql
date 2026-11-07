-- ADR-1658: consulta preparada, sem alterar cadastros; gate iniciado fechado.
create table pcm.sso_breadcrumb_ativo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_breadcrumb_ativo_gate(id,habilitado) values(true,false);
alter table pcm.sso_breadcrumb_ativo_gate enable row level security;
alter table pcm.sso_breadcrumb_ativo_gate force row level security;
revoke all on pcm.sso_breadcrumb_ativo_gate from public,anon,authenticated,service_role;
create function pcm.sso_breadcrumb_ativo(p_ator uuid,p_cliente uuid,p_ativo uuid,p_local_esperado uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_ativo is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_breadcrumb_ativo_gate where id and habilitado for share;
  if not found then raise exception 'breadcrumb_desabilitado' using errcode='55000'; end if;
  if config.sso_autorizar_acao('cadastro.ler',p_cliente) is not true and config.sso_autorizar_acao('cadastro.gerir',p_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  with recursive alvo as (
    select e.id,e.local_id,e.area_id,c.nome as cliente_nome,a.nome as area_nome,a.id as area_encontrada
    from pcm.equipamentos e join pcm.clientes c on c.id=e.client_id and c.id=p_cliente and c.ativo and c.deleted_at is null
    left join pcm.areas a on a.id=e.area_id and a.cliente_id=p_cliente and a.ativo and a.deleted_at is null
    where e.id=p_ativo and e.client_id=p_cliente and e.local_id is not distinct from p_local_esperado and e.ativo and e.deleted_at is null
  ), cadeia as (
    select l.id,l.parent_id,l.area_id,l.nome,l.ativo,l.deleted_at,1 as profundidade,array[l.id] as visitados,false as ciclo
    from alvo e join pcm.locais l on l.id=e.local_id
    union all
    select p.id,p.parent_id,p.area_id,p.nome,p.ativo,p.deleted_at,c.profundidade+1,c.visitados||p.id,p.id=any(c.visitados)
    from cadeia c join pcm.locais p on p.id=c.parent_id where not c.ciclo and c.profundidade<64
  ), verificacao as (
    select coalesce(bool_or(c.ciclo),false) as ciclo,
      coalesce(bool_or(c.profundidade=64 and c.parent_id is not null and not c.ciclo),false) as limite,
      coalesce(bool_or(c.id is not null and (not c.ativo or c.deleted_at is not null or c.area_id is distinct from e.area_id
        or (c.parent_id is not null and not exists(select 1 from pcm.locais p where p.id=c.parent_id)))),false) as invalido,
      array_agg(c.nome order by c.profundidade desc) filter(where c.id is not null) as nomes
    from alvo e left join cadeia c on true group by e.area_id
  )
  select jsonb_build_object('clienteId',p_cliente,'ativoId',p_ativo,
    'estado',case when e.local_id is null and e.area_id is null then 'sem_posicao'
      when e.area_encontrada is null or (e.local_id is not null and v.nomes is null) then 'indisponivel'
      when v.ciclo then 'ciclo' when v.limite then 'limite' when v.invalido then 'indisponivel' else 'disponivel' end,
    'caminho',case when e.area_encontrada is not null and not v.ciclo and not v.limite and not v.invalido
      and (e.local_id is null or v.nomes is not null) then to_jsonb(array[e.cliente_nome,e.area_nome]||coalesce(v.nomes,'{}'::text[]))
      else '[]'::jsonb end) into v_resultado from alvo e join verificacao v on true;
  if v_resultado is null then raise exception 'ativo_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_breadcrumb_ativo(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_breadcrumb_ativo(uuid,uuid,uuid,uuid) to authenticated;
