-- ADR-1641: proposta auditada, sem encerrar ocorrência ou expor núcleo privado.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_propor_encerramento_ocorrencia(uuid,uuid,uuid,uuid,text)'::regprocedure);
 a text:='raise exception ''declaracao_obsoleta'' using errcode=''40001''';b text:='raise exception ''declaracao_obsoleta'' using errcode=''P0010''';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'proposta_encerramento_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $patch$;
create function pcm.sso_propor_encerramento_ocorrencia_mediada(p_ator uuid,p_cliente uuid,p_plano uuid,p_request uuid,p_preparada uuid,p_declaracao uuid,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_escopo_preventivo_mediado(p_ator,p_cliente,p_plano,true);
 if not exists(select 1 from pcm.ocorrencias_rotina_preparadas where id=p_preparada and plano_id=p_plano) then raise exception 'sem_acesso' using errcode='42501';end if;
 return pcm.sso_propor_encerramento_ocorrencia(p_request,p_cliente,p_preparada,p_declaracao,p_motivo);
end; $$;
revoke all on function pcm.sso_propor_encerramento_ocorrencia_mediada(uuid,uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_propor_encerramento_ocorrencia_mediada(uuid,uuid,uuid,uuid,uuid,uuid,text) to authenticated;
