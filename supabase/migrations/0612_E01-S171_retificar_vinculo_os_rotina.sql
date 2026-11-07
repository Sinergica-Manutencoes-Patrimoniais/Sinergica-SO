-- ADR-0386: eventos aditivos; snapshot original permanece intocado.
create table pcm.os_rotina_vinculo_eventos(
  os_id uuid not null references pcm.os_rotina_vinculos_explicitos(os_id),revisao integer not null check(revisao>1),acao text not null check(acao in ('invalidar','retificar')),
  motivo text not null check(length(btrim(motivo)) between 1 and 1000),previa jsonb,rotina_snapshot jsonb,
  request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),primary key(os_id,revisao),
  check((acao='invalidar' and previa is null and rotina_snapshot is null) or (acao='retificar' and previa is not null and rotina_snapshot is not null))
);
alter table pcm.os_rotina_vinculo_eventos enable row level security;
alter table pcm.os_rotina_vinculo_eventos force row level security;
revoke all on pcm.os_rotina_vinculo_eventos from public,anon,authenticated,service_role;
create trigger os_rotina_vinculo_eventos_imutaveis before update or delete on pcm.os_rotina_vinculo_eventos for each row execute function pcm.sso_os_rotina_vinculo_imutavel();
create function pcm.sso_retificar_vinculo_os_rotina(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_revisao integer,p_acao text,p_motivo text,p_previa jsonb default null)
returns integer language plpgsql security definer set search_path='' as $$
declare base pcm.os_rotina_vinculos_explicitos%rowtype; anterior pcm.os_rotina_vinculo_eventos%rowtype; ultimo pcm.os_rotina_vinculo_eventos%rowtype;
  v_revisao integer; v_previa jsonb; v_rotina jsonb; v_count integer;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_revisao is null or p_revisao<1
    or p_acao is null or p_acao not in ('invalidar','retificar') or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
    or (p_acao='invalidar' and p_previa is not null) or (p_acao='retificar' and p_previa is null)
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.os_rotina_vinculo_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('os-rotina-retificar:'||p_request_id::text,0));
  perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into base from pcm.os_rotina_vinculos_explicitos where os_id=p_os_id and cliente_id=p_cliente_id;
  if not found then raise exception 'vinculo_indisponivel' using errcode='42501'; end if;
  select * into anterior from pcm.os_rotina_vinculo_eventos where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.os_id<>p_os_id or anterior.revisao<>p_revisao+1 or anterior.acao<>p_acao
      or anterior.motivo<>btrim(p_motivo) or anterior.previa is distinct from p_previa then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return anterior.revisao;
  end if;
  select * into ultimo from pcm.os_rotina_vinculo_eventos where os_id=p_os_id order by revisao desc limit 1;
  v_revisao:=coalesce(ultimo.revisao,1);
  if v_revisao<>p_revisao or (p_acao='invalidar' and ultimo.acao='invalidar') or (p_acao='retificar' and coalesce(ultimo.acao,'base')<>'invalidar') then raise exception 'revisao_ou_transicao_invalida' using errcode='40001'; end if;
  if p_acao='retificar' then
    perform oc.id from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos ponte on ponte.ocorrencia_legada_id=os.ocorrencia_preventiva_id
      join pcm.ocorrencias_rotina_preparadas oc on oc.id=ponte.ocorrencia_preparada_id join pcm.planos_manutencao plano on plano.id=oc.plano_id and plano.cliente_id=p_cliente_id
      join pcm.plano_versoes versao on versao.id=oc.versao_id and versao.plano_id=plano.id and versao.estado='aprovado'
      where os.id=p_os_id and os.client_id=p_cliente_id and os.deleted_at is null for share of ponte,oc,plano,versao;
    if not found then raise exception 'cadeia_nao_comprovada' using errcode='23514'; end if;
    v_previa:=pcm.sso_prever_vinculo_os_rotina(p_cliente_id,p_os_id);
    if v_previa is distinct from p_previa then raise exception 'origem_obsoleta' using errcode='40001'; end if;
    select count(*),min(item::text)::jsonb into v_count,v_rotina from pcm.plano_versoes pv cross join lateral jsonb_array_elements(pv.snapshot->'rotinas') item
      where pv.id=(v_previa->>'versaoId')::uuid and item->>'id'=v_previa->>'rotinaId';
    if v_count<>1 then raise exception 'rotina_nao_comprovada' using errcode='23514'; end if;
  end if;
  insert into pcm.os_rotina_vinculo_eventos(os_id,revisao,acao,motivo,previa,rotina_snapshot,request_id,ator_id)
    values(p_os_id,v_revisao+1,p_acao,btrim(p_motivo),v_previa,v_rotina,p_request_id,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'os.vinculo_rotina_'||p_acao,'ordens_servico',p_os_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revisao',v_revisao+1,'motivo',btrim(p_motivo)));
  return v_revisao+1;
end $$;
revoke all on function pcm.sso_retificar_vinculo_os_rotina(uuid,uuid,uuid,integer,text,text,jsonb) from public,anon,authenticated,service_role;
create function pcm.sso_historico_vinculo_os_rotina(p_cliente_id uuid,p_os_id uuid,p_apos integer default 0)
returns table(revisao integer,acao text,motivo text,ator_id uuid,criado_em timestamptz,previa jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or p_apos is null or p_apos<0 or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from pcm.os_rotina_vinculo_gate where id),false)
    or not exists(select 1 from pcm.os_rotina_vinculos_explicitos b where b.os_id=p_os_id and b.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select h.revisao,h.acao,h.motivo,h.ator_id,h.criado_em,h.previa from (
    select 1 as revisao,'base'::text as acao,null::text as motivo,b.ator_id,b.criado_em,
      jsonb_build_object('osId',b.os_id,'ocorrenciaLegadaId',b.ocorrencia_legada_id,'ocorrenciaPreparadaId',b.ocorrencia_preparada_id,'planoId',b.plano_id,'versaoId',b.versao_id,'rotinaId',b.rotina_id,'alvoTipo',b.alvo_tipo,'alvoId',b.alvo_id) as previa
      from pcm.os_rotina_vinculos_explicitos b where b.os_id=p_os_id and b.cliente_id=p_cliente_id
    union all select e.revisao,e.acao,e.motivo,e.ator_id,e.criado_em,e.previa from pcm.os_rotina_vinculo_eventos e where e.os_id=p_os_id
  ) h where h.revisao>p_apos order by h.revisao limit 20;
end $$;
revoke all on function pcm.sso_historico_vinculo_os_rotina(uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_status_vinculo_os_rotina(p_cliente_id uuid,p_os_id uuid)
returns table(revisao integer,estado text) language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from pcm.os_rotina_vinculo_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select coalesce(e.revisao,1),case when e.acao='invalidar' then 'invalidado' else 'registrado_nao_revalidado' end
    from pcm.os_rotina_vinculos_explicitos b left join lateral(select x.revisao,x.acao from pcm.os_rotina_vinculo_eventos x where x.os_id=b.os_id order by x.revisao desc limit 1) e on true
    where b.os_id=p_os_id and b.cliente_id=p_cliente_id;
end $$;
revoke all on function pcm.sso_status_vinculo_os_rotina(uuid,uuid) from public,anon,authenticated,service_role;
