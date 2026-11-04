-- ADR-1420: prévias mediadas; sem migração, aceite ou alteração de origem.
create table pcm.sso_preflight_mediado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_preflight_mediado_gate(id,habilitado) values(true,false);
alter table pcm.sso_preflight_mediado_gate enable row level security;
alter table pcm.sso_preflight_mediado_gate force row level security;
revoke all on pcm.sso_preflight_mediado_gate from public,anon,authenticated,service_role;

create function pcm.sso_exigir_preflight_mediado(p_ator_id uuid,p_cliente_id uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_preflight_mediado_gate where id and habilitado for share;
 if not found then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
 perform 1 from pcm.migracao_preflight_gate where id and habilitado for share;
 if not found then raise exception 'diagnostico_bloqueado' using errcode='55000'; end if;
 perform 1 from config.usuarios where user_id=p_ator_id and ativo and papel='superadmin' for share;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_preflight_mediado(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_diagnostico_migracao_mediado(p_ator_id uuid,p_cliente_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_exigir_preflight_mediado(p_ator_id,p_cliente_id);return pcm.sso_diagnosticar_migracao_cliente(p_cliente_id);end; $$;
revoke all on function pcm.sso_diagnostico_migracao_mediado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnostico_migracao_mediado(uuid,uuid) to authenticated;

create function pcm.sso_preflight_codigos_mediado(p_ator_id uuid,p_cliente_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_exigir_preflight_mediado(p_ator_id,p_cliente_id);return pcm.sso_preflight_codigos_entre_clientes(p_cliente_id);end; $$;
revoke all on function pcm.sso_preflight_codigos_mediado(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_preflight_codigos_mediado(uuid,uuid) to authenticated;

create function pcm.sso_prever_referencias_mediada(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(chamado_id uuid,os_legada_id uuid,os_relacionadas bigint,classificacao text)
language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_exigir_preflight_mediado(p_ator_id,p_cliente_id);return query select * from pcm.sso_prever_referencias_chamado_os(p_cliente_id,p_apos,p_limite);end; $$;
revoke all on function pcm.sso_prever_referencias_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_referencias_mediada(uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_prever_planos_legados_mediada(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(plano_id uuid,estado text,alvo_tipo text,alvo_id uuid,ocorrencias bigint,classificacao text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_preflight_mediado(p_ator_id,p_cliente_id);
 return query select f.plano_id,f.estado,f.alvo_tipo,case when num_nonnulls(p.sistema_id,p.equipamento_id)=1 then f.alvo_id else null end,
   f.ocorrencias,case when num_nonnulls(p.sistema_id,p.equipamento_id)<>1 then 'alvo_requer_revisao'::text else f.classificacao end
 from pcm.sso_prever_planos_preventivos_legados(p_cliente_id,p_apos,p_limite) f
 join pcm.planos_preventivos p on p.id=f.plano_id and p.cliente_id=p_cliente_id order by f.plano_id;
end; $$;
revoke all on function pcm.sso_prever_planos_legados_mediada(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_planos_legados_mediada(uuid,uuid,uuid,integer) to authenticated;
