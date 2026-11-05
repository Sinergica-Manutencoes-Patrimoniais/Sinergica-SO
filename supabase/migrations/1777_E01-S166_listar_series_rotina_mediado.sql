-- ADR-1635: leitura autenticada sem expor o núcleo privado.
create function pcm.sso_listar_series_rotina_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_rotina uuid,p_apos uuid,p_limite integer)
returns table(serie_id uuid,criado_em timestamptz)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 perform 1 from pcm.planos_manutencao p where p.id=p_plano and p.cliente_id=p_cliente for share nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
 return query select * from pcm.sso_listar_vinculos_rotina_serie(p_plano,p_rotina,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_series_rotina_mediado(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_series_rotina_mediado(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
