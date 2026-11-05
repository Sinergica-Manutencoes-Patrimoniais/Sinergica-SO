-- Clone descartável, BEGIN/ROLLBACK; sem Auvo e com 1045 intacta.
begin;
\ir manual_E01-S165_reserva_ciclo_1714_setup.sql
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
select pcm.sso_declarar_relacao_legada_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'declarar','Relação conferida');
do $$
declare f jsonb;r jsonb;r2 jsonb;d date;
begin
 d:=pcm.sso_vencimento_ciclo_calendario(current_date,1,'meses',1);
 execute 'set local role authenticated';
 begin
  perform pcm.sso_prever_reserva_calendario_futuro('16630000-1111-4000-8000-000000000002','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',d,'16630000-1111-4000-8000-000000000097',1,1);
  raise exception 'ator_divergente_aceito';
 exception when insufficient_privilege then null;end;
 begin
  perform pcm.sso_prever_reserva_calendario_futuro('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000b','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',d,'16630000-1111-4000-8000-000000000097',1,1);
  raise exception 'outro_cliente_aceito';
 exception when insufficient_privilege then null;end;
 f:=pcm.sso_prever_reserva_calendario_futuro('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',d,'16630000-1111-4000-8000-000000000097',1,1)->'foto';
 begin
  perform pcm.sso_decidir_reserva_calendario_futuro('16630000-1111-4000-8000-000000000001','17190000-1111-4000-8000-000000000010','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',d,'16630000-1111-4000-8000-000000000097',1,1,0,'somente_sso',true,'Foto obsoleta',f||'{"indiceSso":999}'::jsonb);
  raise exception 'foto_obsoleta_aceita';
 exception when serialization_failure then if sqlerrm<>'fotografia_obsoleta' then raise;end if;end;
 r:=pcm.sso_decidir_reserva_calendario_futuro('16630000-1111-4000-8000-000000000001','17190000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',d,'16630000-1111-4000-8000-000000000097',1,1,0,'somente_sso',true,'Ciclo escolhido',f);
 r2:=pcm.sso_decidir_reserva_calendario_futuro('16630000-1111-4000-8000-000000000001','17190000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',d,'16630000-1111-4000-8000-000000000097',1,1,0,'somente_sso',true,'Ciclo escolhido',f);
 execute 'reset role';
 if r->>'reservaId' is distinct from r2->>'reservaId' then raise exception 'replay_divergente';end if;
 if exists(select 1 from pcm.sso_ciclo_calendario_versoes where ciclo_id=(r->>'cicloId')::uuid) then raise exception 'preparada_criada_antes';end if;
 perform pcm.materializar_ocorrencias_preventivas('16630000-1111-4000-8000-000000000097',d);
 if exists(select 1 from pcm.ocorrencias_preventivas where plano_id='16630000-1111-4000-8000-000000000097' and indice=1) then raise exception 'indice_reservado_gerado';end if;
 if not exists(select 1 from pcm.ocorrencias_preventivas where plano_id='16630000-1111-4000-8000-000000000097' and indice=0) then raise exception 'outro_indice_suprimido';end if;
 execute 'set local role authenticated';
 f:=pcm.sso_prever_reserva_calendario_futuro('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',d,'16630000-1111-4000-8000-000000000097',1,1)->'foto';
 perform pcm.sso_decidir_reserva_calendario_futuro('16630000-1111-4000-8000-000000000001','17190000-1111-4000-8000-000000000002','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',d,'16630000-1111-4000-8000-000000000097',1,1,1,'integrar_ponte',true,'Ponte escolhida',f);
 execute 'reset role';
 perform pcm.materializar_ocorrencias_preventivas('16630000-1111-4000-8000-000000000097',d);
 begin
  update pcm.ocorrencias_preventivas set envio_estado='enviando' where plano_id='16630000-1111-4000-8000-000000000097' and indice=1;
  raise exception 'envio_sem_ponte_aceito';
 exception when check_violation then if sqlerrm<>'ponte_reservada_ausente' then raise;end if;end;
end; $$;
do $$ begin if has_function_privilege('anon','pcm.sso_decidir_reserva_calendario_futuro(uuid,uuid,uuid,uuid,uuid,uuid,date,uuid,integer,integer,integer,text,boolean,text,jsonb)','execute') then raise exception 'acl_anon_indevida';end if;end $$;

-- Simular avanço do relógio civil somente na transação: ciclo seguinte cai
-- além da janela de 30 dias a partir da data real. Não simula aprovação.
create or replace function pcm.sso_data_civil_versao_geracao(p_plano_id uuid,p_versao_id uuid)
returns date language sql stable security definer set search_path='' as $$
 select pcm.sso_vencimento_ciclo_calendario(current_date,1,'meses',1)
$$;
create temporary table sso_preparacao_futura_fixture as
 select pcm.sso_vencimento_ciclo_calendario(current_date,1,'meses',1) data,
        ciclo_id from pcm.sso_reservas_ciclo_legado where request_id='17190000-1111-4000-8000-000000000002';
grant select on sso_preparacao_futura_fixture to authenticated;
-- O agendamento PMOC do setup está classificado e pertence à data corrente;
-- não há agendamento na data seguinte. Nenhuma guarda PMOC é desabilitada.
set local role authenticated;
do $$ declare a jsonb;b jsonb;d date;c uuid;begin
 select data,ciclo_id into strict d,c from sso_preparacao_futura_fixture;
 a:=pcm.sso_materializar_ciclo_canonico('17190000-1111-4000-8000-000000000020','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,d);
 b:=pcm.sso_materializar_ciclo_canonico('17190000-1111-4000-8000-000000000020','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021','16630000-1111-4000-8000-000000000031',1,d);
 if a is distinct from b or (a->>'cicloCanonicoId')::uuid is distinct from c or a->>'criada' is distinct from 'true' or a->>'osCriada' is distinct from 'false' or a->>'tarefaAuvoCriada' is distinct from 'false' then raise exception 'preparacao_ou_replay_divergente: %, %',a,b;end if;
end; $$;
reset role;
do $$ declare c uuid;begin
 select ciclo_id into strict c from sso_preparacao_futura_fixture;
 if (select count(*) from pcm.sso_ciclo_calendario_versoes where ciclo_id=c)<>1 then raise exception 'alias_ciclo_incorreto';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_criada';end if;
end; $$;
rollback;
