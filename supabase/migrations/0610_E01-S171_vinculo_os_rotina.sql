-- ADR-0384: vínculo auditado apenas a partir da cadeia existente, sem mudar legado.
create table pcm.os_rotina_vinculo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.os_rotina_vinculo_gate(id,habilitado) values(true,false);
alter table pcm.os_rotina_vinculo_gate enable row level security;
alter table pcm.os_rotina_vinculo_gate force row level security;
revoke all on pcm.os_rotina_vinculo_gate from public,anon,authenticated,service_role;
create table pcm.os_rotina_vinculos_explicitos(
  os_id uuid primary key references pcm.ordens_servico(id),cliente_id uuid not null references pcm.clientes(id),ocorrencia_legada_id uuid not null references pcm.ocorrencias_preventivas(id),
  ocorrencia_preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),plano_id uuid not null references pcm.planos_manutencao(id),
  versao_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null references pcm.rotinas_manutencao(id),
  alvo_tipo text not null,alvo_id uuid not null,rotina_snapshot jsonb not null,request_id uuid not null unique,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.os_rotina_vinculos_explicitos enable row level security;
alter table pcm.os_rotina_vinculos_explicitos force row level security;
revoke all on pcm.os_rotina_vinculos_explicitos from public,anon,authenticated,service_role;
create function pcm.sso_os_rotina_vinculo_imutavel() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'vinculo_imutavel' using errcode='23514'; end $$;
revoke all on function pcm.sso_os_rotina_vinculo_imutavel() from public,anon,authenticated,service_role;
create trigger os_rotina_vinculo_imutavel before update or delete on pcm.os_rotina_vinculos_explicitos for each row execute function pcm.sso_os_rotina_vinculo_imutavel();
create function pcm.sso_prever_vinculo_os_rotina(p_cliente_id uuid,p_os_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r record; v_snapshot jsonb; v_rotina jsonb; v_count integer;
begin
  if auth.uid() is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from pcm.os_rotina_vinculo_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select os.id os_id,os.ocorrencia_preventiva_id legada,oc.id preparada,oc.plano_id,oc.versao_id,oc.rotina_id,oc.alvo_tipo,oc.alvo_id,versao.snapshot
    into r from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos ponte on ponte.ocorrencia_legada_id=os.ocorrencia_preventiva_id
    join pcm.ocorrencias_rotina_preparadas oc on oc.id=ponte.ocorrencia_preparada_id
    join pcm.planos_manutencao plano on plano.id=oc.plano_id and plano.cliente_id=p_cliente_id
    join pcm.plano_versoes versao on versao.id=oc.versao_id and versao.plano_id=plano.id and versao.estado='aprovado'
    where os.id=p_os_id and os.client_id=p_cliente_id and os.deleted_at is null;
  if not found or jsonb_typeof(r.snapshot->'rotinas') is distinct from 'array' then raise exception 'cadeia_nao_comprovada' using errcode='23514'; end if;
  v_snapshot:=r.snapshot;
  select count(*),min(item::text)::jsonb into v_count,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') item where item->>'id'=r.rotina_id::text;
  if v_count<>1 or v_rotina->'alvo'->>'id' is distinct from r.alvo_id::text or v_rotina->'alvo'->>'tipo' is distinct from r.alvo_tipo then raise exception 'alvo_ou_rotina_nao_comprovados' using errcode='23514'; end if;
  return jsonb_build_object('osId',r.os_id,'ocorrenciaLegadaId',r.legada,'ocorrenciaPreparadaId',r.preparada,'planoId',r.plano_id,
    'versaoId',r.versao_id,'rotinaId',r.rotina_id,'alvoTipo',r.alvo_tipo,'alvoId',r.alvo_id);
end $$;
revoke all on function pcm.sso_prever_vinculo_os_rotina(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_vincular_os_rotina(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_previa jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare anterior pcm.os_rotina_vinculos_explicitos%rowtype; v_previa jsonb; v_rotina jsonb; v_count integer;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_previa is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.os_rotina_vinculo_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('os-rotina:'||p_request_id::text,0));
  perform 1 from pcm.ordens_servico where id=p_os_id and client_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from pcm.os_rotina_vinculos_explicitos where request_id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.cliente_id<>p_cliente_id or anterior.os_id<>p_os_id
      or jsonb_build_object('osId',anterior.os_id,'ocorrenciaLegadaId',anterior.ocorrencia_legada_id,'ocorrenciaPreparadaId',anterior.ocorrencia_preparada_id,
        'planoId',anterior.plano_id,'versaoId',anterior.versao_id,'rotinaId',anterior.rotina_id,'alvoTipo',anterior.alvo_tipo,'alvoId',anterior.alvo_id) is distinct from p_previa then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'osId',p_os_id,'state','vinculado');
  end if;
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
  insert into pcm.os_rotina_vinculos_explicitos(os_id,cliente_id,ocorrencia_legada_id,ocorrencia_preparada_id,plano_id,versao_id,rotina_id,alvo_tipo,alvo_id,rotina_snapshot,request_id,ator_id)
    values(p_os_id,p_cliente_id,(v_previa->>'ocorrenciaLegadaId')::uuid,(v_previa->>'ocorrenciaPreparadaId')::uuid,(v_previa->>'planoId')::uuid,
      (v_previa->>'versaoId')::uuid,(v_previa->>'rotinaId')::uuid,v_previa->>'alvoTipo',(v_previa->>'alvoId')::uuid,v_rotina,p_request_id,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'os.ocorrencia_rotina_vinculada','ordens_servico',p_os_id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'ocorrenciaPreparadaId',v_previa->>'ocorrenciaPreparadaId','versaoId',v_previa->>'versaoId','rotinaId',v_previa->>'rotinaId'));
  return jsonb_build_object('requestId',p_request_id,'osId',p_os_id,'state','vinculado');
end $$;
revoke all on function pcm.sso_vincular_os_rotina(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
