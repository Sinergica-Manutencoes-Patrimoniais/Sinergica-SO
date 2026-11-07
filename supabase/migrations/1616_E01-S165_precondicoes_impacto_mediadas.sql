-- ADR-1473: mediação de fotografia parcial; sem autorização de aprovação.
create table pcm.sso_precondicao_impacto_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_precondicao_impacto_mediado_gate(id,habilitado) values(true,false);
alter table pcm.sso_precondicao_impacto_mediado_gate enable row level security;
alter table pcm.sso_precondicao_impacto_mediado_gate force row level security;
revoke all on pcm.sso_precondicao_impacto_mediado_gate from public,anon,authenticated,service_role;

create function pcm.sso_conferir_precondicao_impacto_mediada(p_ator uuid,p_cliente uuid,p_plano uuid,p_escrita boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_plano is null or p_escrita is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_precondicao_impacto_mediado_gate where id and habilitado for share;
 if not found then raise exception 'operacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_precondicao_impacto_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if p_escrita then
  perform 1 from pcm.sso_concorrencia_impacto_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_guardar_impacto_aprovacao_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_avaliacao_impacto_revisao_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_decisao_impacto_revisao_gate where id and habilitado for share;
  if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente) then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_conferir_precondicao_impacto_mediada(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_registrar_precondicao_impacto_mediada(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_vigencia date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_conferir_precondicao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,true);
 r:=pcm.sso_registrar_precondicao_impactos(p_request_id,p_cliente_id,p_plano_id,p_expected_revision,p_vigencia);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_registrar_precondicao_impacto_mediada(uuid,uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_registrar_precondicao_impacto_mediada(uuid,uuid,uuid,uuid,integer,date) to authenticated;

create function pcm.sso_listar_precondicoes_impacto_mediada(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,revisao_plano integer,vigencia date,ator_id uuid,criado_em timestamptz,aprovacao_autorizada boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_precondicao_impacto_mediada(p_ator_id,p_cliente_id,p_plano_id,false);
 return query select * from pcm.sso_listar_precondicoes_impacto(p_cliente_id,p_plano_id,p_apos,p_limite);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_listar_precondicoes_impacto_mediada(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_precondicoes_impacto_mediada(uuid,uuid,uuid,uuid,integer) to authenticated;
