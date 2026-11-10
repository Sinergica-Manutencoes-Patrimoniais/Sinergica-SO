-- ADR-0944: filtro literal antes da paginação, gate fechado.
create table pcm.sso_pendencias_filtro_ativo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_pendencias_filtro_ativo_gate(id,habilitado) values(true,false);
alter table pcm.sso_pendencias_filtro_ativo_gate enable row level security;
alter table pcm.sso_pendencias_filtro_ativo_gate force row level security;
revoke all on pcm.sso_pendencias_filtro_ativo_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_pendencias_por_ativo(p_cliente_id uuid,p_busca text,p_apos uuid,p_limite integer)
returns table(id uuid,alvo_tipo text,alvo_id uuid,alvo_nome text,pergunta text,observacao text,estado text,revisao integer,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
declare v_busca text:=lower(btrim(coalesce(p_busca,''))); v_gate boolean;
begin
  if p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 or length(v_busca)>120 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  select g.habilitado into v_gate from pcm.sso_mediacao_pendencias_retorno_gate g where g.id for share;
  if v_gate is distinct from true then raise exception 'mediacao_pendencias_bloqueada' using errcode='55000'; end if;
  select g.habilitado into v_gate from pcm.sso_pendencias_filtro_ativo_gate g where g.id for share;
  if v_gate is distinct from true then raise exception 'filtro_pendencias_bloqueado' using errcode='55000'; end if;
  if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.id,p.alvo_tipo,p.alvo_id,
    case p.alvo_tipo when 'sistema' then s.nome when 'componente' then e.nome when 'grupo' then g.nome end,
    p.pergunta,p.observacao,p.estado,p.revisao,p.criado_em
    from pcm.sso_pendencias_tecnicas p
    left join pcm.sistemas s on p.alvo_tipo='sistema' and s.id=p.alvo_id and s.cliente_id=p.cliente_id
    left join pcm.equipamentos e on p.alvo_tipo='componente' and e.id=p.alvo_id and e.client_id=p.cliente_id
    left join pcm.grupos_quantitativos g on p.alvo_tipo='grupo' and g.id=p.alvo_id and g.cliente_id=p.cliente_id
    where p.cliente_id=p_cliente_id and (p_apos is null or p.id>p_apos)
      and (v_busca='' or strpos(lower(p.alvo_tipo),v_busca)>0 or strpos(lower(p.alvo_id::text),v_busca)>0
        or strpos(lower(coalesce(case p.alvo_tipo when 'sistema' then s.nome when 'componente' then e.nome when 'grupo' then g.nome end,'')),v_busca)>0)
    order by p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_pendencias_por_ativo(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_pendencias_por_ativo(uuid,text,uuid,integer) to authenticated;
