-- ADR-1643: leitura mediada preserva o núcleo privado e seus gates.
create function pcm.sso_proposta_exigencia_revisao_mediada(p_ator uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_diagnostico_rotina_mediado(p_ator,p_cliente,p_plano);
 return pcm.sso_proposta_exigencia_revisao(p_cliente,p_plano,p_versao,p_rotina);
end; $$;
revoke all on function pcm.sso_proposta_exigencia_revisao_mediada(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_proposta_exigencia_revisao_mediada(uuid,uuid,uuid,uuid,uuid) to authenticated;
