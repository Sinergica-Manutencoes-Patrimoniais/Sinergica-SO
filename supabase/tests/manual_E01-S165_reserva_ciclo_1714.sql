-- Clone descartável, migrations até 1716+, BEGIN/ROLLBACK.
-- Não libera 1045 e não aciona Auvo. Testa calendário; Visita e concorrência são provas separadas.
begin;
\ir manual_E01-S165_reserva_ciclo_1714_setup.sql
set local request.jwt.claims='{"sub":"16630000-1111-4000-8000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"pcm":"escrita"}}';
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_legado_gate set habilitado=true where id;
update pcm.sso_integrar_ciclo_existente_gate set habilitado=true where id;
update pcm.sso_vinculo_visita_legado_gate set habilitado=true where id;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
select pcm.sso_declarar_relacao_legada_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'declarar','Relação conferida');
do $$
declare p uuid; r jsonb; r2 jsonb; f jsonb; c uuid;
begin
 select id into p from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011';
 select ciclo_id into c from pcm.sso_ciclo_calendario_versoes where preparada_id=p;
 f:=pcm.sso_foto_reserva_ciclo('16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097')||jsonb_build_object('modo','calendario','cicloId',c,'preparadaId',p,'indiceLegado',0,'vencimento',current_date);
 execute 'set local role authenticated';
 begin
  perform pcm.sso_decidir_reserva_ciclo_legado('16630000-1111-4000-8000-000000000001','17140000-1111-4000-8000-000000000010','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'calendario',p,'somente_sso',1,0,true,'Foto obsoleta',f||'{"intervalo":99}'::jsonb);
  raise exception 'foto_obsoleta_aceita';
 exception when serialization_failure then if sqlerrm<>'fotografia_obsoleta' then raise;end if; end;
 begin
  perform pcm.sso_decidir_reserva_ciclo_legado('16630000-1111-4000-8000-000000000002','17140000-1111-4000-8000-000000000011','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'calendario',p,'somente_sso',1,0,true,'Ator divergente',f);
  raise exception 'ator_divergente_aceito';
 exception when insufficient_privilege then null; end;
 r:=pcm.sso_decidir_reserva_ciclo_legado('16630000-1111-4000-8000-000000000001','17140000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'calendario',p,'somente_sso',1,0,true,'PCM escolheu este par',f);
 r2:=pcm.sso_decidir_reserva_ciclo_legado('16630000-1111-4000-8000-000000000001','17140000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'calendario',p,'somente_sso',1,0,true,'PCM escolheu este par',f);
 execute 'reset role';
 if r->>'reservaId' is distinct from r2->>'reservaId' then raise exception 'replay_divergente';end if;
 perform pcm.materializar_ocorrencias_preventivas('16630000-1111-4000-8000-000000000097',(current_date+interval '2 months')::date);
 if exists(select 1 from pcm.ocorrencias_preventivas where plano_id='16630000-1111-4000-8000-000000000097' and indice=0) then raise exception 'indice_reservado_gerado';end if;
 if not exists(select 1 from pcm.ocorrencias_preventivas where plano_id='16630000-1111-4000-8000-000000000097' and indice=1) then raise exception 'outro_indice_suprimido';end if;
 begin
  insert into pcm.ocorrencias_preventivas(plano_id,indice,vencimento,chave_externa) values('16630000-1111-4000-8000-000000000097',0,current_date,'1714-nao-permitida');
  raise exception 'insercao_reservada_aceita';
 exception when check_violation then if sqlerrm<>'indice_reservado_ao_sso' then raise;end if; end;
 execute 'set local role authenticated';
 r:=pcm.sso_decidir_reserva_ciclo_legado('16630000-1111-4000-8000-000000000001','17140000-1111-4000-8000-000000000002','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'calendario',p,'somente_legado',1,1,true,'PCM revisou este par',f);
 execute 'reset role';
 begin
  perform pcm.sso_conferir_execucao_sso_reservada('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',p,'calendario');
  raise exception 'execucao_sso_aceita';
 exception when check_violation then if sqlerrm<>'ciclo_reservado_ao_legado' then raise;end if; end;
 perform pcm.sso_materializar_ciclo_legado(gen_random_uuid(),'16630000-1111-4000-8000-00000000000a',p,'16630000-1111-4000-8000-000000000097','16630000-1111-4000-8000-000000000098',gen_random_uuid(),'Ponte conferida');
 execute 'set local role authenticated';
 r:=pcm.sso_decidir_reserva_ciclo_legado('16630000-1111-4000-8000-000000000001','17140000-1111-4000-8000-000000000003','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000097',0,'calendario',p,'integrar_ponte',1,2,true,'Ponte específica conferida',f);
 execute 'reset role';
 perform pcm.sso_conferir_execucao_sso_reservada('16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',p,'calendario');
 if r->>'revisao'<>'3' then raise exception 'revisao_incorreta';end if;
end; $$;
rollback;
