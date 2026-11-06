-- Somente clone sintético, BEGIN/ROLLBACK, migrations até 1680.
\ir manual_E01-S165_S166_ponte_legada_mediada.sql
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
update pcm.sso_diagnostico_revisao_mediado_gate set habilitado=true where id;
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by)
select '16630000-1111-4000-8000-000000000181',cliente_id,sistema_id,questionario_id,tipo_tarefa_id,'Outro legado',primeira_data,intervalo_unidade,intervalo_n,estado,created_by from pcm.planos_preventivos where id='16630000-1111-4000-8000-000000000097';
set local role authenticated;
do $$ declare v jsonb;a jsonb;b jsonb;r jsonb;begin
 v:=pcm.sso_prever_legado_nao_relacionado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000181',2);
 r:=pcm.sso_avaliar_impacto_revisao_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'visita_legado');
 if (r->>'planosClienteSemRelacaoDeclarada')::int<>1 then raise exception 'legado_deveria_estar_pendente: %',r;end if;
 a:=pcm.sso_classificar_legado_nao_relacionado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000182','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000181',2,v->>'hash','Contrato distinto','Verificado pelo PCM');
 b:=pcm.sso_classificar_legado_nao_relacionado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000182','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000181',2,v->>'hash','Contrato distinto','Verificado pelo PCM');
 if a is distinct from b then raise exception 'replay_divergente';end if;
 r:=pcm.sso_avaliar_impacto_revisao_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'visita_legado');
 if (r->>'planosClienteSemRelacaoDeclarada')::int<>0 then raise exception 'classificacao_nao_considerada: %',r;end if;
end; $$;
reset role;
update pcm.planos_preventivos set nome='Legado alterado' where id='16630000-1111-4000-8000-000000000181';
set local role authenticated;
do $$ declare r jsonb;begin
 r:=pcm.sso_avaliar_impacto_revisao_mediado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'visita_legado');
 if (r->>'planosClienteSemRelacaoDeclarada')::int<>1 then raise exception 'classificacao_obsoleta_aceita: %',r;end if;
end; $$;
reset role;
do $$ begin if has_function_privilege('anon','pcm.sso_classificar_legado_nao_relacionado(uuid,uuid,uuid,uuid,uuid,integer,text,text,text)','execute') then raise exception 'acl_anon_indevida';end if;end; $$;
