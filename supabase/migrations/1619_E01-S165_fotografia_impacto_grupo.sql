-- ADR-1476: complemento para decisões de impacto; não autoriza aprovação.
create table pcm.sso_impacto_grupo_fotografias(
 tipo text not null check(tipo in ('calendario','visita')),request_id uuid not null,
 cliente_id uuid not null,plano_id uuid not null,preparada_id uuid not null,
 fotografia jsonb not null,criado_em timestamptz not null default now(),primary key(tipo,request_id)
);
alter table pcm.sso_impacto_grupo_fotografias enable row level security;
alter table pcm.sso_impacto_grupo_fotografias force row level security;
revoke all on pcm.sso_impacto_grupo_fotografias from public,anon,authenticated,service_role;
create trigger sso_impacto_grupo_fotografias_imutavel before update or delete on pcm.sso_impacto_grupo_fotografias for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Travas protegem também inserções novas, não somente linhas já conhecidas.
create function pcm.sso_travar_fontes_impacto_grupo() returns void language plpgsql volatile security definer set search_path='' as $$
begin
 lock table pcm.sso_ocorrencias_grupo,pcm.sso_vinculos_os_grupo,pcm.sso_intencoes_os_grupo,
  pcm.sso_atestados_declarados_grupo,pcm.sso_fotos_atestado_grupo,pcm.sso_decisoes_foto_grupo,
  pcm.sso_quantidades_declaradas_grupo,pcm.sso_pendencias_tecnicas,pcm.os_rotina_vinculos_explicitos,
  pcm.sso_ciclo_calendario_versoes,pcm.sso_ciclo_visita_versoes,
  pcm.sso_chamados_ciclo_preventivo,pcm.sso_chamados_ciclo_visita,pcm.ordens_servico in share mode nowait;
end; $$;
revoke all on function pcm.sso_travar_fontes_impacto_grupo() from public,anon,authenticated,service_role;

create function pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text)
returns jsonb language sql stable security definer set search_path='' as $$
 with preparadas as (
  select p_preparada id
  union select outra.preparada_id from pcm.sso_ciclo_calendario_versoes atual
   join pcm.sso_ciclo_calendario_versoes outra on outra.ciclo_id=atual.ciclo_id
   join pcm.ocorrencias_rotina_preparadas o on o.id=outra.preparada_id and o.plano_id=p_plano
   where p_tipo='calendario' and atual.preparada_id=p_preparada
  union select outra.preparada_id from pcm.sso_ciclo_visita_versoes atual
   join pcm.sso_ciclo_visita_versoes outra on outra.ciclo_id=atual.ciclo_id
   join pcm.ocorrencias_visita_preparadas o on o.id=outra.preparada_id and o.plano_id=p_plano
   where p_tipo='visita' and atual.preparada_id=p_preparada
 ), grupo as (
  select g.* from pcm.sso_ocorrencias_grupo g where g.cliente_id=p_cliente and g.plano_id=p_plano
   and ((p_tipo='calendario' and g.calendario_preparado_id in (select id from preparadas)) or (p_tipo='visita' and g.visita_preparada_id in (select id from preparadas)))
 ), os_ids as (
  select v.os_id from grupo g join pcm.sso_vinculos_os_grupo v on v.ocorrencia_grupo_id=g.id
  union select v.os_id from pcm.os_rotina_vinculos_explicitos v where p_tipo='calendario' and v.ocorrencia_preparada_id in (select id from preparadas)
  union select os.id from pcm.sso_ciclo_calendario_versoes cv join pcm.sso_chamados_ciclo_preventivo c on c.ciclo_id=cv.ciclo_id join pcm.ordens_servico os on os.chamado_id=c.chamado_id where p_tipo='calendario' and cv.preparada_id=p_preparada
  union select os.id from pcm.sso_ciclo_visita_versoes cv join pcm.sso_chamados_ciclo_visita c on c.ciclo_id=cv.ciclo_id join pcm.ordens_servico os on os.chamado_id=c.chamado_id where p_tipo='visita' and cv.preparada_id=p_preparada
 )
 select jsonb_build_object(
  'grupo',coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from grupo g),'[]'::jsonb),
  'vinculosGrupo',coalesce((select jsonb_agg(to_jsonb(x) order by x.request_id) from pcm.sso_vinculos_os_grupo x join grupo g on g.id=x.ocorrencia_grupo_id),'[]'::jsonb),
  'intencoes',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from pcm.sso_intencoes_os_grupo x join grupo g on g.id=x.ocorrencia_grupo_id),'[]'::jsonb),
  'atestados',coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from pcm.sso_atestados_declarados_grupo x join grupo g on g.id=x.ocorrencia_id),'[]'::jsonb),
  'fotos',coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from pcm.sso_fotos_atestado_grupo x join grupo g on g.id=x.ocorrencia_id),'[]'::jsonb),
  'decisoesFotos',coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from pcm.sso_decisoes_foto_grupo x join grupo g on g.id=x.ocorrencia_id),'[]'::jsonb),
  'quantidades',coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from pcm.sso_quantidades_declaradas_grupo x join grupo g on g.id=x.ocorrencia_id),'[]'::jsonb),
  'pendencias',coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from pcm.sso_pendencias_tecnicas x join grupo g on g.id=x.ocorrencia_grupo_id),'[]'::jsonb),
  'vinculosExplicitos',coalesce((select jsonb_agg(to_jsonb(x) order by x.os_id) from pcm.os_rotina_vinculos_explicitos x where p_tipo='calendario' and x.ocorrencia_preparada_id in (select id from preparadas)),'[]'::jsonb),
  'chamadosCalendario',coalesce((select jsonb_agg(to_jsonb(c) order by c.ciclo_id) from pcm.sso_ciclo_calendario_versoes cv join pcm.sso_chamados_ciclo_preventivo c on c.ciclo_id=cv.ciclo_id where p_tipo='calendario' and cv.preparada_id=p_preparada),'[]'::jsonb),
  'chamadosVisita',coalesce((select jsonb_agg(to_jsonb(c) order by c.ciclo_id) from pcm.sso_ciclo_visita_versoes cv join pcm.sso_chamados_ciclo_visita c on c.ciclo_id=cv.ciclo_id where p_tipo='visita' and cv.preparada_id=p_preparada),'[]'::jsonb),
  'os',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'clienteId',o.client_id,'status',o.status,'atualizadaEm',o.updated_at,'excluidaEm',o.deleted_at) order by o.id) from os_ids i join pcm.ordens_servico o on o.id=i.os_id),'[]'::jsonb)
 );
$$;
revoke all on function pcm.sso_fotografar_efeitos_impacto_grupo(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

alter function pcm.sso_decidir_impacto_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) rename to sso_decidir_impacto_mediada_base_1619;
revoke all on function pcm.sso_decidir_impacto_mediada_base_1619(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
create function pcm.sso_decidir_impacto_mediada(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_rascunho_id uuid,p_preparada_id uuid,p_expected_plano integer,p_expected_decisao integer,p_decisao text,p_motivo text,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_resultado jsonb;v_fotografia jsonb;v_existia boolean;v_guardada pcm.sso_impacto_grupo_fotografias%rowtype;
begin
 if p_tipo is null or p_tipo not in ('calendario','visita') or p_request_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,p_tipo='visita');
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(case when p_tipo='visita' then 'decisao-impacto-visita:' else 'decisao-impacto:' end||p_request_id::text,0)) then raise exception 'decisao_em_andamento' using errcode='55P03'; end if;
 select exists(select 1 from pcm.sso_decisoes_impacto_ocorrencia d where p_tipo='calendario' and d.request_id=p_request_id union all select 1 from pcm.sso_decisoes_impacto_visita d where p_tipo='visita' and d.request_id=p_request_id) into v_existia;
 if v_existia then
  v_resultado:=pcm.sso_decidir_impacto_mediada_base_1619(p_ator_id,p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,p_expected_decisao,p_decisao,p_motivo,p_tipo);
  select * into v_guardada from pcm.sso_impacto_grupo_fotografias f where f.tipo=p_tipo and f.request_id=p_request_id and f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.preparada_id=p_preparada_id;
  if not found then raise exception 'decisao_sem_fotografia_grupo_requer_nova' using errcode='23514'; end if;
  return v_resultado;
 end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_resultado:=pcm.sso_decidir_impacto_mediada_base_1619(p_ator_id,p_request_id,p_cliente_id,p_plano_id,p_rascunho_id,p_preparada_id,p_expected_plano,p_expected_decisao,p_decisao,p_motivo,p_tipo);
 v_fotografia:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente_id,p_plano_id,p_preparada_id,p_tipo);
 insert into pcm.sso_impacto_grupo_fotografias(tipo,request_id,cliente_id,plano_id,preparada_id,fotografia) values(p_tipo,p_request_id,p_cliente_id,p_plano_id,p_preparada_id,v_fotografia);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_impacto_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_decidir_impacto_mediada(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,text,text,text) to authenticated;

create function pcm.sso_avaliar_fotografias_grupo_mediada(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_plano integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_origem uuid;v_rascunho uuid;v_total bigint;v_sem_foto bigint;v_obsoletas bigint;v_grupos bigint;v_com_os bigint;
begin
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,false);
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_plano for share nowait;
 if not found then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_previa:=pcm.sso_previa_revisao_revisionada(p_plano_id,p_expected_plano,1,null);
 v_origem:=(v_previa->>'versaoAnteriorId')::uuid;v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 with ocorrencias as (
  select 'calendario'::text tipo,o.id from pcm.ocorrencias_rotina_preparadas o where o.plano_id=p_plano_id and o.versao_id=v_origem
  union all select 'visita',o.id from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano_id and o.versao_id=v_origem
 ), decisoes as (
  select 'calendario'::text tipo,d.request_id,d.preparada_id,d.revisao,d.revisao_plano from pcm.sso_decisoes_impacto_ocorrencia d where d.rascunho_id=v_rascunho
  union all select 'visita',d.request_id,d.preparada_id,d.revisao,d.revisao_plano from pcm.sso_decisoes_impacto_visita d where d.rascunho_id=v_rascunho
 ), itens as (
  select o.tipo,o.id,d.request_id,d.revisao_plano,f.fotografia,
    pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente_id,p_plano_id,o.id,o.tipo) atual
  from ocorrencias o left join lateral (select x.* from decisoes x where x.tipo=o.tipo and x.preparada_id=o.id order by x.revisao desc limit 1) d on true
  left join pcm.sso_impacto_grupo_fotografias f on f.tipo=o.tipo and f.request_id=d.request_id and f.cliente_id=p_cliente_id and f.plano_id=p_plano_id and f.preparada_id=o.id
 ) select count(*),count(*) filter(where fotografia is null),count(*) filter(where fotografia is not null and (revisao_plano is distinct from p_expected_plano or fotografia is distinct from atual)),
 count(*) filter(where jsonb_array_length(atual->'grupo')>0),count(*) filter(where jsonb_array_length(atual->'os')>0)
 into v_total,v_sem_foto,v_obsoletas,v_grupos,v_com_os from itens;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('revisaoPlano',p_expected_plano,'ocorrenciasObservadas',v_total,'fotografiasAusentes',v_sem_foto,'fotografiasObsoletas',v_obsoletas,'ocorrenciasComGrupo',v_grupos,'ocorrenciasComOsAssociada',v_com_os,'fontesCompletas',false,'aprovacaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_avaliar_fotografias_grupo_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_avaliar_fotografias_grupo_mediada(uuid,uuid,uuid,integer) to authenticated;
