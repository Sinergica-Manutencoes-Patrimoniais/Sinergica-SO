-- ADR-0390: conferência transacional de cadeia sem despacho.
create table pcm.os_rotina_conferencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.os_rotina_conferencia_gate(id,habilitado) values(true,false);
alter table pcm.os_rotina_conferencia_gate enable row level security;
alter table pcm.os_rotina_conferencia_gate force row level security;
revoke all on pcm.os_rotina_conferencia_gate from public,anon,authenticated,service_role;
create table pcm.os_rotina_conferencias(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),visita_id uuid not null references pcm.visitas(id),
  revisao_visita integer not null check(revisao_visita>0),os_id uuid not null references pcm.os_rotina_vinculos_explicitos(os_id),revisao_vinculo integer not null check(revisao_vinculo>0),
  previa jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table pcm.os_rotina_conferencias enable row level security;
alter table pcm.os_rotina_conferencias force row level security;
revoke all on pcm.os_rotina_conferencias from public,anon,authenticated,service_role;
create trigger os_rotina_conferencias_imutaveis before update or delete on pcm.os_rotina_conferencias for each row execute function pcm.sso_os_rotina_vinculo_imutavel();
create function pcm.sso_revalidar_vinculo_os_conteudo(p_request_id uuid,p_cliente_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao_visita integer,p_revisao_vinculo integer,p_previa jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v pcm.visitas%rowtype; base pcm.os_rotina_vinculos_explicitos%rowtype; ev pcm.os_rotina_vinculo_eventos%rowtype;
  anterior pcm.os_rotina_conferencias%rowtype; v_revisao integer; v_esperada jsonb; v_snapshot jsonb; v_atual jsonb; v_contagem integer;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_visita_id is null or p_os_id is null or p_revisao_visita is null
    or p_revisao_vinculo is null or p_previa is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.os_rotina_conferencia_gate where id),false)
    or not coalesce((select habilitado from pcm.os_rotina_vinculo_gate where id),false)
    or not coalesce((select habilitado from pcm.os_conteudo_revisao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('os-rotina-conferir:'||p_request_id::text,0));
  select * into v from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from pcm.os_rotina_conferencias where id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.cliente_id<>p_cliente_id or anterior.visita_id<>p_visita_id or anterior.os_id<>p_os_id
      or anterior.revisao_visita<>p_revisao_visita or anterior.revisao_vinculo<>p_revisao_vinculo or anterior.previa is distinct from p_previa then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'osId',p_os_id,'revisaoVinculo',anterior.revisao_vinculo,'state','vinculo_conferido_sem_envio');
  end if;
  perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for update;
  if not found or v.estado<>'planejada' or v.revisao<>p_revisao_visita
    or not exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v.id and vo.os_id=p_os_id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null) then raise exception 'origem_obsoleta' using errcode='40001'; end if;
  select * into base from pcm.os_rotina_vinculos_explicitos where os_id=p_os_id and cliente_id=p_cliente_id;
  if not found then raise exception 'vinculo_nao_comprovado' using errcode='23514'; end if;
  select * into ev from pcm.os_rotina_vinculo_eventos where os_id=p_os_id order by revisao desc limit 1;
  v_revisao:=coalesce(ev.revisao,1);
  if v_revisao<>p_revisao_vinculo or ev.acao='invalidar' then raise exception 'vinculo_obsoleto_ou_invalidado' using errcode='40001'; end if;
  if v_revisao=1 then
    v_esperada:=jsonb_build_object('osId',base.os_id,'ocorrenciaLegadaId',base.ocorrencia_legada_id,'ocorrenciaPreparadaId',base.ocorrencia_preparada_id,
      'planoId',base.plano_id,'versaoId',base.versao_id,'rotinaId',base.rotina_id,'alvoTipo',base.alvo_tipo,'alvoId',base.alvo_id); v_snapshot:=base.rotina_snapshot;
  else v_esperada:=ev.previa; v_snapshot:=ev.rotina_snapshot; end if;
  perform oc.id from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos ponte on ponte.ocorrencia_legada_id=os.ocorrencia_preventiva_id
    join pcm.ocorrencias_rotina_preparadas oc on oc.id=ponte.ocorrencia_preparada_id join pcm.planos_manutencao plano on plano.id=oc.plano_id and plano.cliente_id=p_cliente_id
    join pcm.plano_versoes versao on versao.id=oc.versao_id and versao.plano_id=plano.id and versao.estado='aprovado'
    where os.id=p_os_id and os.client_id=p_cliente_id and os.deleted_at is null for share of ponte,oc,plano,versao;
  if not found then raise exception 'cadeia_nao_comprovada' using errcode='23514'; end if;
  v_atual:=pcm.sso_prever_vinculo_os_rotina(p_cliente_id,p_os_id);
  if v_atual is distinct from p_previa or v_atual is distinct from v_esperada then raise exception 'cadeia_alterada' using errcode='40001'; end if;
  select count(*),min(item::text)::jsonb into v_contagem,v_atual from pcm.plano_versoes pv cross join lateral jsonb_array_elements(pv.snapshot->'rotinas') item
    where pv.id=(v_esperada->>'versaoId')::uuid and item->>'id'=v_esperada->>'rotinaId';
  if v_contagem<>1 or v_atual is distinct from v_snapshot then raise exception 'snapshot_divergente' using errcode='23514'; end if;
  insert into pcm.os_rotina_conferencias(id,cliente_id,visita_id,revisao_visita,os_id,revisao_vinculo,previa,ator_id)
    values(p_request_id,p_cliente_id,v.id,v.revisao,p_os_id,v_revisao,v_esperada,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'os.vinculo_rotina_conferido','ordens_servico',p_os_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'visitaId',v.id,'revisaoVisita',v.revisao,'revisaoVinculo',v_revisao));
  return jsonb_build_object('requestId',p_request_id,'osId',p_os_id,'revisaoVinculo',v_revisao,'state','vinculo_conferido_sem_envio');
end $$;
revoke all on function pcm.sso_revalidar_vinculo_os_conteudo(uuid,uuid,uuid,uuid,integer,integer,jsonb) from public,anon,authenticated,service_role;
