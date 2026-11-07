-- Clone, BEGIN/ROLLBACK. Fontes e relação sintéticas; RPCs chamadas como authenticated.
\ir manual_E01-S165_visita_futura_1703_setup.sql
reset role;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
set local session_replication_role=replica;
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by)
 values('16610000-0000-0000-0000-000000000910','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000120','16610000-0000-0000-0000-000000000911','16610000-0000-0000-0000-000000000912','Legado teste',date_trunc('week',current_date+14)::date+11,'semanas',1,'ativo','16610000-0000-0000-0000-000000000001');
insert into pcm.sso_declaracoes_planos_legados(request_id,cliente_id,plano_id,plano_legado_id,revisao,decisao,motivo,ator_id,payload,resultado)
 values('16610000-0000-0000-0000-000000000913','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000910',1,'declarar','fixture','16610000-0000-0000-0000-000000000001','{}','{}');
set local session_replication_role=origin;
insert into pcm.feriados_declarados(id,cliente_id,data,fonte,motivo,criado_por) values('16610000-0000-0000-0000-000000000917','16610000-0000-0000-0000-00000000000a',date_trunc('week',current_date+14)::date+11,'fixture','feriado teste','16610000-0000-0000-0000-000000000001');
set local role authenticated;
do $$ begin
 begin perform pcm.sso_prever_reserva_visita_futura('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000910',0,3);raise exception 'feriado_ignorado';exception when check_violation then if sqlerrm<>'visita_exige_reconciliacao' then raise;end if;end;
end; $$;
reset role;
delete from pcm.feriados_declarados where id='16610000-0000-0000-0000-000000000917';
set local role authenticated;
do $$ declare f jsonb;a jsonb;b jsonb;begin
 begin perform pcm.sso_prever_reserva_visita_futura('16610000-0000-0000-0000-000000000099','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000910',0,3);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;
 begin perform pcm.sso_prever_reserva_visita_futura('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000910',0,3);raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
 f:=pcm.sso_prever_reserva_visita_futura('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000910',0,3);
 if f->>'equivalenciaComprovada'<>'false' or f->>'fontesFeriadosCompletas'<>'false' then raise exception 'previa_divergente';end if;
 a:=pcm.sso_decidir_reserva_visita_futura('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000914','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000910',0,3,0,'somente_sso',true,'conferido',f->'foto');
 b:=pcm.sso_decidir_reserva_visita_futura('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000914','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000083','16610000-0000-0000-0000-000000000910',0,3,0,'somente_sso',true,'conferido',f->'foto');
 if a->>'reservaId' is distinct from b->>'reservaId' or b->>'replay'<>'true' or a->>'ocorrenciaCriada'<>'false' then raise exception 'reserva_ou_replay_divergente';end if;
end; $$;
reset role;
do $$ begin if exists(select 1 from pcm.ocorrencias_visita_preparadas where visita_id='16610000-0000-0000-0000-000000000083') then raise exception 'ocorrencia_indevida';end if;end; $$;

-- A fixture põe o Plano em estado operacional apenas no clone para testar a geração posterior;
-- não simula aprovação da revisão nem altera a função 1045.
set local session_replication_role=replica;
update pcm.planos_manutencao set estado='aprovado' where id='16610000-0000-0000-0000-000000000121';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000915','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000916','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000083',3,'fonte sintética');
 b:=pcm.sso_preparar_visita_canonica('16610000-0000-0000-0000-000000000915','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000916','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122','16610000-0000-0000-0000-000000000123','16610000-0000-0000-0000-000000000083',3,'fonte sintética');
 if a is distinct from b or a->>'osCriada'<>'false' or a->>'tarefaAuvoCriada'<>'false' then raise exception 'geracao_ou_replay_divergente: %',a;end if;
end; $$;
reset role;
do $$ begin
 if not exists(select 1 from pcm.sso_reservas_ciclo_legado r join pcm.sso_ciclo_visita_versoes cv on cv.ciclo_id=r.ciclo_id where r.request_id='16610000-0000-0000-0000-000000000914' and cv.preparada_id='16610000-0000-0000-0000-000000000916') then raise exception 'identidade_reservada_nao_reutilizada';end if;
 if has_function_privilege('anon','pcm.sso_decidir_reserva_visita_futura(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text,jsonb)','execute') then raise exception 'acl_anon_indevida';end if;
end; $$;
