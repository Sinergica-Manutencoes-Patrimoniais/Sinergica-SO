-- ADR-1636: comando mediado preserva núcleo privado e replay existente.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_vincular_rotina_serie_preparado(uuid,uuid,uuid,uuid,uuid,integer)'::regprocedure);
 a text:='raise exception ''revisao_obsoleta'' using errcode=''40001''';
 b text:='raise exception ''revisao_obsoleta'' using errcode=''P0011''';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'vinculo_revisao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
create function pcm.sso_vincular_serie_rotina_mediado(p_ator uuid,p_cliente uuid,p_request uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_serie uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501';
 end if;
 perform 1 from pcm.planos_manutencao p where p.id=p_plano and p.cliente_id=p_cliente for update nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
 r:=pcm.sso_vincular_rotina_serie_preparado(p_request,p_plano,p_versao,p_rotina,p_serie,p_revisao);
 return r;
end; $$;
revoke all on function pcm.sso_vincular_serie_rotina_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_vincular_serie_rotina_mediado(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
