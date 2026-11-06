-- ADR-1638: mediação dos diagnósticos sem expor núcleos privados.
create function pcm.sso_conferir_diagnostico_rotina_mediado(p_ator uuid,p_cliente uuid,p_plano uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
end; $$;
revoke all on function pcm.sso_conferir_diagnostico_rotina_mediado(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_diagnosticar_modo_visita_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_diagnostico_rotina_mediado(p_ator,p_cliente,p_plano);
 return pcm.sso_diagnosticar_modo_visita(p_cliente,p_plano,p_versao,p_rotina);
end; $$;
revoke all on function pcm.sso_diagnosticar_modo_visita_mediado(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_modo_visita_mediado(uuid,uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_diagnosticar_exigencia_aprovada_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_diagnostico_rotina_mediado(p_ator,p_cliente,p_plano);
 return pcm.sso_diagnosticar_exigencia_aprovada(p_cliente,p_plano,p_versao,p_rotina);
end; $$;
revoke all on function pcm.sso_diagnosticar_exigencia_aprovada_mediado(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_exigencia_aprovada_mediado(uuid,uuid,uuid,uuid,uuid) to authenticated;
