create table pcm.sso_mediacao_gestao_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_mediacao_gestao_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_mediacao_gestao_grupo_gate enable row level security;
alter table pcm.sso_mediacao_gestao_grupo_gate force row level security;
revoke all on pcm.sso_mediacao_gestao_grupo_gate from public,anon,authenticated,service_role;

create function pcm.sso_exigir_gestao_grupo_mediada(p_grupo_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_mediacao_gestao_grupo_gate where id),false) then raise exception 'gestao_grupo_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_grupo_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 select cliente_id into v_cliente from pcm.grupos_quantitativos where id=p_grupo_id;
 if not found or v_cliente is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
end; $$;
revoke all on function pcm.sso_exigir_gestao_grupo_mediada(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_mover_grupo_autorizado(p_request_id uuid,p_grupo_id uuid,p_expected_revision integer,p_local_destino_id uuid,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_gestao_grupo_mediada(p_grupo_id); return pcm.sso_mover_grupo(p_request_id,p_grupo_id,p_expected_revision,p_local_destino_id,p_motivo); end; $$;
revoke all on function pcm.sso_mover_grupo_autorizado(uuid,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_mover_grupo_autorizado(uuid,uuid,integer,uuid,text) to authenticated;

create function pcm.sso_reclassificar_grupo_autorizado(p_request_id uuid,p_grupo_id uuid,p_expected_revision integer,p_categoria_id uuid,p_sistema_id uuid,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_gestao_grupo_mediada(p_grupo_id); return pcm.sso_reclassificar_grupo(p_request_id,p_grupo_id,p_expected_revision,p_categoria_id,p_sistema_id,p_motivo); end; $$;
revoke all on function pcm.sso_reclassificar_grupo_autorizado(uuid,uuid,integer,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_reclassificar_grupo_autorizado(uuid,uuid,integer,uuid,uuid,text) to authenticated;

create function pcm.sso_quantidade_grupo_autorizada(p_request_id uuid,p_grupo_id uuid,p_expected_revision integer,p_quantidade bigint,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform pcm.sso_exigir_gestao_grupo_mediada(p_grupo_id); return pcm.sso_alterar_quantidade_grupo(p_request_id,p_grupo_id,p_expected_revision,p_quantidade,p_motivo); end; $$;
revoke all on function pcm.sso_quantidade_grupo_autorizada(uuid,uuid,integer,bigint,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_quantidade_grupo_autorizada(uuid,uuid,integer,bigint,text) to authenticated;
