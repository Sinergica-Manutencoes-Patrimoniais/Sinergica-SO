-- ADR-0560: captura transacional de precondições sem habilitar aprovação.
create table pcm.sso_precondicao_impacto_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_precondicao_impacto_gate enable row level security;alter table pcm.sso_precondicao_impacto_gate force row level security;
revoke all on pcm.sso_precondicao_impacto_gate from public,anon,authenticated,service_role;
insert into pcm.sso_precondicao_impacto_gate(id,habilitado) values(true,false);
create table pcm.sso_precondicoes_impacto_revisao (
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),revisao_plano integer not null,vigencia date not null,fotografia jsonb not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_precondicoes_impacto_revisao enable row level security;alter table pcm.sso_precondicoes_impacto_revisao force row level security;
revoke all on pcm.sso_precondicoes_impacto_revisao from public,anon,authenticated,service_role;
create trigger sso_precondicao_impacto_imutavel before update or delete on pcm.sso_precondicoes_impacto_revisao for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_registrar_precondicao_impactos(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_vigencia date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_ant pcm.sso_precondicoes_impacto_revisao%rowtype;v_preflight jsonb;v_calendario jsonb;v_visitas jsonb;v_payload jsonb;v_foto jsonb;v_resultado jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_precondicao_impacto_gate where id),false) then raise exception 'precondicao_impacto_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<1 or p_vigencia is null or not isfinite(p_vigencia) then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'revisao',p_expected_revision,'vigencia',p_vigencia);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('precondicao-impacto:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 if not coalesce((select habilitado from pcm.sso_concorrencia_impacto_gate where id),false) or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'protocolo_concorrencia_indisponivel' using errcode='55P03';end if;
 select * into v_ant from pcm.sso_precondicoes_impacto_revisao where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update nowait;
 if not found then raise exception 'plano_indisponivel' using errcode='42501';end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 perform id from pcm.ocorrencias_rotina_preparadas where plano_id=p_plano_id order by id for share nowait;
 perform id from pcm.ocorrencias_visita_preparadas where plano_id=p_plano_id order by id for share nowait;
 perform os.id from pcm.ordens_servico os where os.client_id=p_cliente_id and os.deleted_at is null and (exists(select 1 from pcm.ocorrencias_rotina_vinculos c join pcm.ocorrencias_rotina_preparadas o on o.id=c.ocorrencia_preparada_id where o.plano_id=p_plano_id and c.ocorrencia_legada_id=os.ocorrencia_preventiva_id) or exists(select 1 from pcm.sso_vinculos_visita_legado v join pcm.ocorrencias_visita_preparadas o on o.id=v.ocorrencia_visita_id where o.plano_id=p_plano_id and v.ocorrencia_legada_id=os.ocorrencia_preventiva_id)) order by os.id for share nowait;
 v_preflight:=pcm.sso_preflight_aprovacao_revisao(p_cliente_id,p_plano_id,p_expected_revision,p_vigencia);
 v_calendario:=pcm.sso_avaliar_decisoes_impacto(p_cliente_id,p_plano_id,p_expected_revision);
 v_visitas:=pcm.sso_avaliar_fontes_impacto_visita_legado(p_cliente_id,p_plano_id,p_expected_revision);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_foto:=jsonb_build_object('preflight',v_preflight,'calendario',v_calendario,'visitasLegado',v_visitas);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'planoId',p_plano_id,'revisao',p_expected_revision,'vigencia',p_vigencia,'fotografiaRegistrada',true,'fontesCompletasComprovadas',false,'provaTransacionalIntegral',false,'aprovacaoAutorizada',false,'versaoAlterada',false,'osAlteradas',false);
 insert into pcm.sso_precondicoes_impacto_revisao(request_id,cliente_id,plano_id,revisao_plano,vigencia,fotografia,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,p_expected_revision,p_vigencia,v_foto,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.precondicao_impactos_registrada','planos_manutencao',p_plano_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_registrar_precondicao_impactos(uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;

create function pcm.sso_listar_precondicoes_impacto(p_cliente_id uuid,p_plano_id uuid,p_apos uuid default null,p_limite integer default 20)
returns table(request_id uuid,revisao_plano integer,vigencia date,ator_id uuid,criado_em timestamptz,aprovacao_autorizada boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_precondicao_impacto_gate where id),false) then raise exception 'precondicao_impacto_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023';end if;
 return query select p.request_id,p.revisao_plano,p.vigencia,p.ator_id,p.criado_em,false from pcm.sso_precondicoes_impacto_revisao p where p.plano_id=p_plano_id and p.cliente_id=p_cliente_id and (p_apos is null or p.request_id>p_apos) order by p.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_precondicoes_impacto(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
