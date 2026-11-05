-- Clone isolado; BEGIN/ROLLBACK; nenhum efeito externo e 1045 preservada.
begin;
\ir manual_E01-S165_impacto_calendario_nativo_1704.sql
reset role;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
set local session_replication_role=replica;
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values ('17220000-1111-4000-8000-000000000097','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000033','17220000-1111-4000-8000-000000000095','17220000-1111-4000-8000-000000000096','Legado sintético',current_date,'meses',1,'ativo','16630000-1111-4000-8000-000000000001');
insert into pcm.sso_declaracoes_planos_legados(request_id,cliente_id,plano_id,plano_legado_id,revisao,decisao,motivo,ator_id,payload,resultado) values ('17220000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','17220000-1111-4000-8000-000000000097',1,'declarar','fixture','16630000-1111-4000-8000-000000000001','{}','{}');
set local session_replication_role=origin;
insert into pcm.ocorrencias_preventivas(plano_id,indice,vencimento,chave_externa) values('17220000-1111-4000-8000-000000000097',1,pcm.sso_vencimento_ciclo_calendario(current_date,1,'meses',1),'fixture-1725-pendente');
do $$ declare v_rotina uuid;f jsonb;a jsonb;b jsonb;begin
 select id into v_rotina from pcm.rotinas_manutencao where versao_id='16630000-1111-4000-8000-000000000022' limit 1;
 execute 'set local role authenticated';
 begin perform pcm.sso_prever_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000002','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',v_rotina,1,'17220000-1111-4000-8000-000000000097',1,2);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;
 begin perform pcm.sso_prever_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000b','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',v_rotina,1,'17220000-1111-4000-8000-000000000097',1,2);raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
 f:=pcm.sso_prever_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',v_rotina,1,'17220000-1111-4000-8000-000000000097',1,2)->'foto';
 begin perform pcm.sso_escolher_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','17220000-1111-4000-8000-000000000101','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',v_rotina,1,'17220000-1111-4000-8000-000000000097',1,2,0,'somente_legado',true,'fixture',f||'{"indiceSso":99}'::jsonb);raise exception 'foto_obsoleta_aceita';exception when serialization_failure then if sqlerrm<>'fotografia_obsoleta' then raise;end if;end;
 a:=pcm.sso_escolher_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','17220000-1111-4000-8000-000000000102','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',v_rotina,1,'17220000-1111-4000-8000-000000000097',1,2,0,'somente_legado',true,'fixture',f);
 b:=pcm.sso_escolher_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','17220000-1111-4000-8000-000000000102','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',v_rotina,1,'17220000-1111-4000-8000-000000000097',1,2,0,'somente_legado',true,'fixture',f);
 if a is distinct from b or a->>'efeitoOperacional'<>'false' then raise exception 'escolha_replay_divergente';end if;
 execute 'reset role';
 update config.sso_concessoes set ativa=false where usuario_id='16630000-1111-4000-8000-000000000001' and cliente_id='16630000-1111-4000-8000-00000000000a' and acao='plano.gerir';
 execute 'set local role authenticated';
 begin perform pcm.sso_escolher_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','17220000-1111-4000-8000-000000000102','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',v_rotina,1,'17220000-1111-4000-8000-000000000097',1,2,0,'somente_legado',true,'fixture',f);raise exception 'revogacao_ignorada';exception when insufficient_privilege then null;end;
 execute 'reset role';
 if exists(select 1 from pcm.sso_selos_reserva_futura_rascunho where escolha_request_id='17220000-1111-4000-8000-000000000102') then raise exception 'selo_antes_aprovacao';end if;
end $$;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and cliente_id='16630000-1111-4000-8000-00000000000a' and acao='plano.gerir';
do $$ declare a jsonb;begin
 a:=pcm.sso_avaliar_fontes_impacto_visita_legado('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2);
 if (a->>'legadasSemPonteObservada')::integer<>0 then raise exception 'escolha_atual_nao_considerada: %',a;end if;
 insert into pcm.avaliacoes_preventivas(ocorrencia_id,chave_origem) select id,'fixture-1736' from pcm.ocorrencias_preventivas where chave_externa='fixture-1725-pendente';
 a:=pcm.sso_avaliar_fontes_impacto_visita_legado('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2);
 if (a->>'legadasSemPonteObservada')::integer<>1 then raise exception 'avaliacao_calendario_ignorada: %',a;end if;
 if not (pcm.sso_prever_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',(select id from pcm.rotinas_manutencao where versao_id='16630000-1111-4000-8000-000000000022' limit 1),1,'17220000-1111-4000-8000-000000000097',1,2)->'foto'->>'efeitoLegado')::boolean then raise exception 'previa_calendario_ignora_avaliacao'; end if;
 delete from pcm.avaliacoes_preventivas where chave_origem='fixture-1736';
 update pcm.ocorrencias_preventivas set envio_estado='falha' where chave_externa='fixture-1725-pendente';
 a:=pcm.sso_avaliar_fontes_impacto_visita_legado('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2);
 if (a->>'legadasSemPonteObservada')::integer<>1 then raise exception 'efeito_ou_foto_obsoleta_ignorado: %',a;end if;
 update pcm.ocorrencias_preventivas set envio_estado='prevista' where chave_externa='fixture-1725-pendente';
 perform set_config('session_replication_role','replica',true);
 insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id) select '17250000-1111-4000-8000-000000000101','16630000-1111-4000-8000-00000000000a','OS-1725','OS sintética','preventiva','16630000-1111-4000-8000-000000000001',id from pcm.ocorrencias_preventivas where chave_externa='fixture-1725-pendente';
 perform set_config('session_replication_role','origin',true);
 a:=pcm.sso_avaliar_fontes_impacto_visita_legado('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2);
 if (a->>'legadasSemPonteObservada')::integer<>1 then raise exception 'os_legada_ignorada: %',a;end if;
end $$;
do $$ begin if has_function_privilege('anon','pcm.sso_escolher_reserva_calendario_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,integer,integer,text,boolean,text,jsonb)','execute') then raise exception 'acl_anon_indevida';end if;end $$;
rollback;
