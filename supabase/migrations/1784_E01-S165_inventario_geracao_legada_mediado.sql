-- ADR-1642: inventário agregado autenticado sem expor o núcleo privado.
create function pcm.sso_inventariar_geracao_legada_mediada(p_ator uuid,p_cliente uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 return pcm.sso_inventariar_geracao_legada(p_cliente);
end; $$;
revoke all on function pcm.sso_inventariar_geracao_legada_mediada(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_inventariar_geracao_legada_mediada(uuid,uuid) to authenticated;
