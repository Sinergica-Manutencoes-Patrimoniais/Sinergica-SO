-- Clone BEGIN/ROLLBACK; legado e OS sintéticos; sem alterar 1045.
-- Clone, BEGIN/ROLLBACK. Fontes e relação sintéticas; não altera guarda 1045.
\ir manual_E01-S165_visita_futura_1703_setup.sql
reset role;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
set local session_replication_role=replica;
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values('16610000-0000-0000-0000-000000000930','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000120','16610000-0000-0000-0000-000000000931','16610000-0000-0000-0000-000000000932','Legado teste',date_trunc('week',current_date+14)::date+11,'semanas',1,'ativo','16610000-0000-0000-0000-000000000001');
insert into pcm.sso_declaracoes_planos_legados(request_id,cliente_id,plano_id,plano_legado_id,revisao,decisao,motivo,ator_id,payload,resultado) values('16610000-0000-0000-0000-000000000933','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000930',1,'declarar','fixture','16610000-0000-0000-0000-000000000001','{}','{}');
insert into pcm.ocorrencias_preventivas(id,plano_id,indice,vencimento,chave_externa,envio_estado) values('16610000-0000-0000-0000-000000000936','16610000-0000-0000-0000-000000000930',0,date_trunc('week',current_date+14)::date+11,'LEGADA-1725','prevista');
set local session_replication_role=origin;
create temporary table fixture1723_rotina as select id from pcm.rotinas_manutencao where versao_id='16610000-0000-0000-0000-000000000181' and rotina_logica_id='16610000-0000-0000-0000-000000000124';
grant select on fixture1723_rotina to authenticated;
set local role authenticated;
do $$ declare f jsonb;a jsonb;b jsonb;v_rot uuid;begin
 select id into v_rot from fixture1723_rotina;
 begin perform pcm.sso_prever_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3);raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
 f:=pcm.sso_prever_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3);
 begin perform pcm.sso_decidir_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000934','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3,0,'somente_legado',true,'conferido','{}');raise exception 'foto_invalida_aceita';exception when serialization_failure then null;end;
 a:=pcm.sso_decidir_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000935','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3,0,'somente_legado',true,'conferido',f->'foto');
 b:=pcm.sso_decidir_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000935','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3,0,'somente_legado',true,'conferido',f->'foto');
 if a is distinct from b or a->>'rascunhoNaoAprovado'<>'true' then raise exception 'escolha_ou_replay_divergente';end if;
end; $$;
reset role;
do $$ begin
 if exists(select 1 from pcm.sso_selos_reserva_futura_rascunho where escolha_request_id='16610000-0000-0000-0000-000000000935') or exists(select 1 from pcm.sso_reservas_ciclo_legado where request_id='16610000-0000-0000-0000-000000000935') then raise exception 'efeito_antes_aprovacao';end if;
 if has_function_privilege('anon','pcm.sso_decidir_reserva_visita_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text,jsonb)','execute') then raise exception 'acl_anon_indevida';end if;
end; $$;


-- Avaliador real deve descontar somente a ocorrência comprovada.
do $$ declare r jsonb;begin
 r:=pcm.sso_avaliar_fontes_impacto_visita_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3);
 if (r->>'legadasSemPonteObservada')::integer<>0 then raise exception 'legada_nao_descontada: %',r;end if;
end; $$;
-- OS sintética da mesma ocorrência invalida a resolução; nada é enviado.
set local session_replication_role=replica;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id) values('16610000-0000-0000-0000-000000000937','16610000-0000-0000-0000-00000000000a','OS-1725','fixture','preventiva','16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000936');
set local session_replication_role=origin;
do $$ declare r jsonb;begin r:=pcm.sso_avaliar_fontes_impacto_visita_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3);if (r->>'legadasSemPonteObservada')::integer<>1 then raise exception 'os_nao_reabriu_pendencia: %',r;end if;end; $$;
set local session_replication_role=replica;
delete from pcm.ordens_servico where id='16610000-0000-0000-0000-000000000937';
update pcm.planos_preventivos set intervalo_n=2 where id='16610000-0000-0000-0000-000000000930';
set local session_replication_role=origin;
do $$ declare r jsonb;begin r:=pcm.sso_avaliar_fontes_impacto_visita_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3);if (r->>'legadasSemPonteObservada')::integer<>1 then raise exception 'foto_obsoleta_nao_reabriu_pendencia: %',r;end if;end; $$;
set local session_replication_role=replica;
update pcm.planos_preventivos set intervalo_n=1 where id='16610000-0000-0000-0000-000000000930';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare f jsonb;v_rot uuid;begin
 select id into v_rot from fixture1723_rotina;
 f:=pcm.sso_prever_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3);
 perform pcm.sso_decidir_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000938','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3,1,'integrar_ponte',true,'nova decisão',f->'foto');
end; $$;
reset role;
do $$ declare r jsonb;begin r:=pcm.sso_avaliar_fontes_impacto_visita_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3);if (r->>'legadasSemPonteObservada')::integer<>0 then raise exception 'ponte_futura_nao_reconhecida: %',r;end if;end; $$;

-- Mesmo com a escolha de ponte, uma OS legada nova volta a exigir reconciliacao.
set local session_replication_role=replica;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id) values('16610000-0000-0000-0000-000000000939','16610000-0000-0000-0000-00000000000a','OS-1727','fixture','preventiva','16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000936');
set local session_replication_role=origin;
do $$ declare r jsonb;begin r:=pcm.sso_avaliar_fontes_impacto_visita_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3);if (r->>'legadasSemPonteObservada')::integer<>1 then raise exception 'os_apos_ponte_ignorada: %',r;end if;end $$;

-- Ambiguidade sintetica de duas Rotinas para o mesmo indice deve manter pendencia.
set local session_replication_role=replica;
delete from pcm.ordens_servico where id='16610000-0000-0000-0000-000000000939';
insert into pcm.sso_escolhas_reserva_futura_rascunho(request_id,cliente_id,plano_id,rascunho_id,rotina_id,modo,legado_id,indice_legado,data_sso,indice_sso,decisao,revisao_plano,revisao_escolha,ator_id,foto,payload,resultado)
 select '17270000-0000-4000-8000-000000000001',cliente_id,plano_id,rascunho_id,'17270000-0000-4000-8000-000000000002',modo,legado_id,indice_legado,data_sso,indice_sso,decisao,revisao_plano,revisao_escolha,ator_id,foto,payload,resultado
 from pcm.sso_escolhas_reserva_futura_rascunho where request_id='16610000-0000-0000-0000-000000000938';
set local session_replication_role=origin;
do $$ declare r jsonb;begin r:=pcm.sso_avaliar_fontes_impacto_visita_legado('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',3);if (r->>'legadasSemPonteObservada')::integer<>1 then raise exception 'escolha_ambigua_ignorada: %',r;end if;end $$;
