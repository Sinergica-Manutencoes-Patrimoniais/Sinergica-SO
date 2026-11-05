-- Clone, BEGIN/ROLLBACK. Fontes e relação sintéticas; não altera guarda 1045.
\ir manual_E01-S165_visita_futura_1703_setup.sql
reset role;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
set local session_replication_role=replica;
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values('16610000-0000-0000-0000-000000000930','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000120','16610000-0000-0000-0000-000000000931','16610000-0000-0000-0000-000000000932','Legado teste',date_trunc('week',current_date+14)::date+11,'semanas',1,'ativo','16610000-0000-0000-0000-000000000001');
insert into pcm.sso_declaracoes_planos_legados(request_id,cliente_id,plano_id,plano_legado_id,revisao,decisao,motivo,ator_id,payload,resultado) values('16610000-0000-0000-0000-000000000933','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000930',1,'declarar','fixture','16610000-0000-0000-0000-000000000001','{}','{}');
set local session_replication_role=origin;
create temporary table fixture1723_rotina as select id from pcm.rotinas_manutencao where versao_id='16610000-0000-0000-0000-000000000181' and rotina_logica_id='16610000-0000-0000-0000-000000000124';
grant select on fixture1723_rotina to authenticated;
set local role authenticated;
do $$ declare f jsonb;a jsonb;b jsonb;v_rot uuid;begin
 select id into v_rot from fixture1723_rotina;
 begin perform pcm.sso_prever_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3);raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
 f:=pcm.sso_prever_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3);
 begin perform pcm.sso_decidir_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000934','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3,0,'somente_sso',true,'conferido','{}');raise exception 'foto_invalida_aceita';exception when sqlstate 'P0013' then if sqlerrm<>'fotografia_obsoleta' then raise;end if;end;
 a:=pcm.sso_decidir_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000935','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3,0,'somente_sso',true,'conferido',f->'foto');
 b:=pcm.sso_decidir_reserva_visita_rascunho('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000935','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',v_rot,'16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000930',0,3,0,'somente_sso',true,'conferido',f->'foto');
 if a is distinct from b or a->>'rascunhoNaoAprovado'<>'true' then raise exception 'escolha_ou_replay_divergente';end if;
end; $$;
reset role;
do $$ begin
 if exists(select 1 from pcm.sso_selos_reserva_futura_rascunho where escolha_request_id='16610000-0000-0000-0000-000000000935') or exists(select 1 from pcm.sso_reservas_ciclo_legado where request_id='16610000-0000-0000-0000-000000000935') then raise exception 'efeito_antes_aprovacao';end if;
 if has_function_privilege('anon','pcm.sso_decidir_reserva_visita_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text,jsonb)','execute') then raise exception 'acl_anon_indevida';end if;
end; $$;
