-- Somente clone com migrations até 1674, em BEGIN/ROLLBACK.
-- Aprovação e selo são fixture artificial; guarda 1045 não é alterada.
\ir manual_E01-S165_S166_ponte_legada_mediada.sql
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
update pcm.sso_estado_ocorrencia_vinculada_gate set habilitado=true where id;
set local session_replication_role=replica;
update pcm.plano_versoes set vigencia_fim=current_date where id='16630000-1111-4000-8000-000000000021';
update pcm.plano_versoes set estado='aprovado',vigencia_inicio=current_date+1,snapshot=jsonb_set(jsonb_set((select snapshot from pcm.plano_versoes where id='16630000-1111-4000-8000-000000000021'),'{rotinas}','[]'::jsonb),'{fuso_plano,vigenciaInicio}',to_jsonb((current_date+1)::text)) where id='16630000-1111-4000-8000-000000000022';
update pcm.ocorrencias_rotina_preparadas set vencimento_original=current_date+2 where plano_id='16630000-1111-4000-8000-000000000011';
update pcm.ocorrencias_preventivas set vencimento=current_date+2 where plano_id='16630000-1111-4000-8000-000000000097';
insert into pcm.sso_resolucoes_impacto_revisao(request_id,tipo,cliente_id,plano_id,rascunho_id,preparada_id,decisao_request_id,revisao_plano,revisao_decisao,motivo,ator_id,payload,resultado)
select '16630000-1111-4000-8000-000000000301','calendario','16630000-1111-4000-8000-00000000000a',o.plano_id,'16630000-1111-4000-8000-000000000022',o.id,'16630000-1111-4000-8000-000000000092',2,1,'fixture','16630000-1111-4000-8000-000000000001','{}','{}' from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.sso_retiradas_impacto_aprovadas(tipo,versao_id,preparada_id,resolucao_request_id,vigencia)
select 'calendario','16630000-1111-4000-8000-000000000022',o.id,'16630000-1111-4000-8000-000000000301',current_date+1 from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.sso_fila_preventiva_pcm(ciclo_id,cliente_id,plano_id,preparada_id,estado,revisao)
select cv.ciclo_id,'16630000-1111-4000-8000-00000000000a',o.plano_id,o.id,'aguardando',1 from pcm.ocorrencias_rotina_preparadas o join pcm.sso_ciclo_calendario_versoes cv on cv.preparada_id=o.id and cv.versao_id=o.versao_id where o.plano_id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;begin
 a:=pcm.sso_aplicar_retiradas_fila('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000302','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',50,null,null);
 if (a->>'visitadas')::integer<>0 or (a->>'canceladas')::integer<>0 then raise exception 'retirada_antecipada: %',a;end if;
end; $$;
reset role;
set local session_replication_role=replica;
update pcm.plano_versoes set vigencia_fim=current_date-1 where id='16630000-1111-4000-8000-000000000021';
update pcm.plano_versoes set vigencia_inicio=current_date,snapshot=jsonb_set(snapshot,'{fuso_plano,vigenciaInicio}',to_jsonb(current_date::text)) where id='16630000-1111-4000-8000-000000000022';
update pcm.sso_retiradas_impacto_aprovadas set vigencia=current_date where versao_id='16630000-1111-4000-8000-000000000022';
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id)
select '16630000-1111-4000-8000-000000000303','16630000-1111-4000-8000-00000000000a','OS-1674','OS fixture','preventiva','16630000-1111-4000-8000-000000000001',v.ocorrencia_legada_id from pcm.ocorrencias_rotina_vinculos v join pcm.ocorrencias_rotina_preparadas o on o.id=v.ocorrencia_preparada_id where o.plano_id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;begin
 a:=pcm.sso_aplicar_retiradas_fila('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000304','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',50,null,null);
 if (a->>'pendentesConferencia')::integer<>1 or (a->>'canceladas')::integer<>0 then raise exception 'os_deveria_preservar_fila: %',a;end if;
end; $$;
reset role;
set local session_replication_role=replica;
delete from pcm.ordens_servico where id='16630000-1111-4000-8000-000000000303';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aplicar_retiradas_fila('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000305','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',50,null,null);
 b:=pcm.sso_aplicar_retiradas_fila('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000305','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',50,null,null);
 if a is distinct from b or (a->>'canceladas')::integer<>1 or a->>'osAlteradas' is distinct from 'false' or a->>'tarefaAuvoCriada' is distinct from 'false' then raise exception 'retirada_ou_replay_divergente: %',a;end if;
end; $$;
reset role;
do $$ begin
 if (select estado from pcm.sso_fila_preventiva_pcm where plano_id='16630000-1111-4000-8000-000000000011') is distinct from 'cancelado' then raise exception 'fila_nao_cancelada';end if;
 if (select count(*) from audit.events where entity_id='16630000-1111-4000-8000-000000000011' and action='plano.retirada_aplicada_fila')<>1 then raise exception 'auditoria_ausente_ou_duplicada';end if;
end; $$;
