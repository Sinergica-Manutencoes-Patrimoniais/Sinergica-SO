-- ADR-1640: acesso mediado ao escopo, preservando os núcleos privados.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_declarar_escopo_preventivo(uuid,uuid,uuid,integer,uuid[],text)'::regprocedure);
 a text:='raise exception ''revisao_obsoleta'' using errcode=''40001''';b text:='raise exception ''revisao_obsoleta'' using errcode=''P0011''';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'declaracao_escopo_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
create function pcm.sso_conferir_escopo_preventivo_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_escrita boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_serializar_autorizacao_rotina();
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or config.sso_autorizar_acao('execucao.validar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_escrita then perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
 else perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;end if;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
end; $$;
revoke all on function pcm.sso_conferir_escopo_preventivo_mediado(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_listar_ocorrencias_escopo_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_apos uuid,p_limite integer)
returns table(id uuid,vencimento_original date,alvo_tipo text,alvo_id uuid) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_escopo_preventivo_mediado(p_ator,p_cliente,p_plano,false);
 return query select * from pcm.sso_listar_ocorrencias_escopo(p_cliente,p_plano,p_versao,p_rotina,p_apos,p_limite);
end; $$;
revoke all on function pcm.sso_listar_ocorrencias_escopo_mediado(uuid,uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_ocorrencias_escopo_mediado(uuid,uuid,uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_previa_escopo_preventivo_mediada(p_ator uuid,p_cliente uuid,p_plano uuid,p_ocorrencia uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_escopo_preventivo_mediado(p_ator,p_cliente,p_plano,false);
 return pcm.sso_previa_escopo_preventivo(p_cliente,p_plano,p_ocorrencia);
end; $$;
revoke all on function pcm.sso_previa_escopo_preventivo_mediada(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_previa_escopo_preventivo_mediada(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_diagnosticar_escopo_preventivo_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_ocorrencia uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_escopo_preventivo_mediado(p_ator,p_cliente,p_plano,false);
 return pcm.sso_diagnosticar_fechamento_preventivo(p_cliente,p_plano,p_ocorrencia);
end; $$;
revoke all on function pcm.sso_diagnosticar_escopo_preventivo_mediado(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_escopo_preventivo_mediado(uuid,uuid,uuid,uuid) to authenticated;

create function pcm.sso_declarar_escopo_preventivo_mediado(p_ator uuid,p_cliente uuid,p_plano uuid,p_request uuid,p_ocorrencia uuid,p_revisao integer,p_os uuid[],p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_escopo_preventivo_mediado(p_ator,p_cliente,p_plano,true);
 if not exists(select 1 from pcm.ocorrencias_rotina_preparadas where id=p_ocorrencia and plano_id=p_plano) then raise exception 'sem_acesso' using errcode='42501';end if;
 return pcm.sso_declarar_escopo_preventivo(p_request,p_cliente,p_ocorrencia,p_revisao,p_os,p_motivo);
end; $$;
revoke all on function pcm.sso_declarar_escopo_preventivo_mediado(uuid,uuid,uuid,uuid,uuid,integer,uuid[],text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_escopo_preventivo_mediado(uuid,uuid,uuid,uuid,uuid,integer,uuid[],text) to authenticated;
