-- Após migrations até 1676, executar em clone sintético e BEGIN/ROLLBACK.
\ir manual_E01-S166_grupo_fila_fixture.sql
insert into pcm.sso_series_ciclo_calendario(id,plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade) values ('17390000-0000-4000-8000-000000000015','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000010','grupo','17390000-0000-4000-8000-000000000006','2026-01-01',1,'meses');
insert into pcm.sso_ciclos_calendario_canonicos(id,serie_id,indice,vencimento_original) values ('17390000-0000-4000-8000-000000000016','17390000-0000-4000-8000-000000000015',0,'2026-01-01');
insert into pcm.sso_ciclo_calendario_versoes(preparada_id,ciclo_id,versao_id,ator_id) values ('17390000-0000-4000-8000-000000000011','17390000-0000-4000-8000-000000000016','17390000-0000-4000-8000-000000000008','17390000-0000-4000-8000-000000000001');
insert into pcm.sso_fila_preventiva_pcm(ciclo_id,cliente_id,plano_id,preparada_id,estado,revisao) values ('17390000-0000-4000-8000-000000000016','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','verificacao',1);
update pcm.sso_fila_preventiva_pcm_gate set habilitado=true where id;
update pcm.sso_confirmar_fila_preventiva_gate set habilitado=true where id;
update pcm.sso_ocorrencia_grupo_gate set habilitado=true where id;
update pcm.sso_estado_ocorrencia_vinculada_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"17390000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
do $$ declare v jsonb;a jsonb;b jsonb; begin
 v:=pcm.sso_prever_fila_grupo('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario');
 if v->>'confirmavel'<>'true' or v->>'fontesExternasComprovadas'<>'false' or (v->>'gruposRegistrados')::integer<>1 then raise exception 'previa_divergente: %',v;end if;
 a:=pcm.sso_declarar_fila_grupo('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000020','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario',1,v->>'fotografiaHash','registros internos e livro de campo','revisão PCM');
 b:=pcm.sso_declarar_fila_grupo('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000020','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario',1,v->>'fotografiaHash','registros internos e livro de campo','revisão PCM');
 if a is distinct from b or a->>'filaAlterada'<>'false' or a->>'osAlteradas'<>'false' or a->>'fontesExternasComprovadas'<>'false' then raise exception 'recibo_divergente: %',a;end if;
 if pcm.sso_estado_ocorrencia_vinculada('17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011')->>'estado'<>'candidata_aguardando' then raise exception 'declaracao_nao_considerada';end if;
 a:=pcm.sso_confirmar_fila_preventiva('17390000-0000-4000-8000-000000000021','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011',1,'fila conferida');
 if a->>'estado'<>'aguardando' or a->>'osCriada'<>'false' then raise exception 'confirmacao_divergente: %',a;end if;
end; $$;
reset role;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by) values ('17390000-0000-4000-8000-000000000014','17390000-0000-4000-8000-000000000002','OS-S173-FIXTURE','OS sintética','corretiva','solicitacao','media','manual','17390000-0000-4000-8000-000000000001');
insert into pcm.sso_vinculos_os_grupo(request_id,cliente_id,ocorrencia_grupo_id,os_id,motivo,ator_id,payload) values ('17390000-0000-4000-8000-000000000022','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000012','17390000-0000-4000-8000-000000000014','Fixture','17390000-0000-4000-8000-000000000001','{}');
set local role authenticated;
do $$ begin
 if pcm.sso_estado_ocorrencia_vinculada('17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011')->>'estado'<>'indeterminado' then raise exception 'fotografia_obsoleta_aceita';end if;
end; $$;
reset role;
do $$ begin if has_function_privilege('anon','pcm.sso_declarar_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text,text,text)','execute') then raise exception 'acl_anon_indevida';end if;end; $$;
