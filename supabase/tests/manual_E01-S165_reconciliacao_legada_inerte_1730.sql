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

-- Selo, nova versão e eliminação de ocorrência puramente sintéticos; estas
-- escritas somente montam cenário em rollback, não provam fluxo de aprovação.
-- 1045 não é removida nem substituída.
set local session_replication_role=replica;
delete from pcm.ocorrencias_preventivas where plano_id='16630000-1111-4000-8000-000000000097' and indice=1;
update pcm.plano_versoes set vigencia_fim=current_date where id='16630000-1111-4000-8000-000000000021';
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,vigencia_fim,snapshot,created_by)
 select '17240000-1111-4000-8000-000000000021',plano_id,2,'aprovado',current_date+1,current_date+365,
 jsonb_set(jsonb_set(snapshot,'{fuso_plano,vigenciaInicio}',to_jsonb((current_date+1)::text)),'{rotinas,0,id}',to_jsonb('17240000-1111-4000-8000-000000000034'::text)),created_by
 from pcm.plano_versoes where id='16630000-1111-4000-8000-000000000021';
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by)
 select '17240000-1111-4000-8000-000000000034',rotina_logica_id,plano_id,'17240000-1111-4000-8000-000000000021',nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by
 from pcm.rotinas_manutencao where id='16630000-1111-4000-8000-000000000031';
insert into pcm.sso_escolhas_reserva_futura_rascunho(request_id,cliente_id,plano_id,rascunho_id,rotina_id,modo,legado_id,indice_legado,data_sso,indice_sso,decisao,revisao_plano,revisao_escolha,ator_id,foto,payload,resultado)
 select '17240000-1111-4000-8000-000000000031',r.cliente_id,r.plano_id,'17240000-1111-4000-8000-000000000021','17240000-1111-4000-8000-000000000034','calendario',r.legado_id,r.indice_legado,
 pcm.sso_vencimento_ciclo_calendario(current_date,1,'meses',1),1,'somente_sso',1,1,r.ator_id,
 pcm.sso_foto_reserva_ciclo(r.plano_id,r.legado_id)||jsonb_build_object('regraSso',(select snapshot->'rotinas'->0 from pcm.plano_versoes where id='17240000-1111-4000-8000-000000000021')),'{}'::jsonb,'{}'::jsonb
 from pcm.sso_reservas_ciclo_legado r where r.request_id='17190000-1111-4000-8000-000000000002' and r.ativa;
insert into pcm.sso_selos_reserva_futura_rascunho(escolha_request_id,versao_id,vigencia,modo,ciclo_id,reserva_anterior_id)
 select '17240000-1111-4000-8000-000000000031','17240000-1111-4000-8000-000000000021',current_date+1,'calendario',r.ciclo_id,r.id
 from pcm.sso_reservas_ciclo_legado r where r.request_id='17190000-1111-4000-8000-000000000002' and r.ativa;
update pcm.planos_manutencao set revisao=revisao+1 where id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
-- A reserva antiga (integrar_ponte) segue em vigor apesar da nova revisão.
do $$ declare r uuid;begin
 select id into strict r from pcm.sso_reservas_ciclo_legado where request_id='17190000-1111-4000-8000-000000000002';
 if pcm.sso_foto_reserva_operacional_valida(r) is distinct from true then raise exception 'reserva_anterior_nao_preservada';end if;
 if pcm.sso_indice_legado_reservado_sso('16630000-1111-4000-8000-000000000097',1) is distinct from false then raise exception 'supressao_antecipada';end if;
end; $$;
-- Geracao legada real antes da vigencia, ainda permitida pela reserva anterior.
select pcm.materializar_ocorrencias_preventivas('16630000-1111-4000-8000-000000000097',pcm.sso_vencimento_ciclo_calendario(current_date,1,'meses',1));
-- Simular somente avanço civil; rollback restaura a função original.
create or replace function pcm.sso_data_civil_transicao_plano(p_plano uuid,p_versao uuid,p_vigencia date)
returns date language sql volatile security definer set search_path='' as $$ select current_date+1 $$;
do $$
declare l uuid;f jsonb;r jsonb;r2 jsonb;est text;
begin
 select id into strict l from pcm.ocorrencias_preventivas where plano_id='16630000-1111-4000-8000-000000000097' and indice=1;
 begin
  perform pcm.sso_indice_legado_reservado_sso('16630000-1111-4000-8000-000000000097',1);
  raise exception 'ausencia_de_reconciliacao_aceita';
 exception when check_violation then if sqlerrm<>'efeito_legado_exige_reconciliacao' then raise;end if;end;
 execute 'set local role authenticated';
 f:=pcm.sso_prever_reconciliacao_legada_sso('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',l,'17240000-1111-4000-8000-000000000031')->'foto';
 begin
  perform pcm.sso_reconciliar_legada_sso('16630000-1111-4000-8000-000000000001','17290000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',l,'17240000-1111-4000-8000-000000000031','Conferido',f||'{"indice":999}'::jsonb);
  raise exception 'foto_obsoleta_aceita';
 exception when serialization_failure then if sqlerrm<>'fotografia_obsoleta' then raise;end if;end;
 r:=pcm.sso_reconciliar_legada_sso('16630000-1111-4000-8000-000000000001','17290000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',l,'17240000-1111-4000-8000-000000000031','Conferido',f);
 r2:=pcm.sso_reconciliar_legada_sso('16630000-1111-4000-8000-000000000001','17290000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',l,'17240000-1111-4000-8000-000000000031','Conferido',f);
 if r is distinct from r2 then raise exception 'replay_divergente';end if;
 select estado into strict est from pcm.sso_estados_legadas_inertes('16630000-1111-4000-8000-00000000000a',array[l]);
 if est<>'substituida' then raise exception 'estado_incorreto';end if;
 begin perform pcm.sso_estados_legadas_inertes('16630000-1111-4000-8000-00000000000b',array[l]);raise exception 'outro_cliente_aceito';exception when insufficient_privilege then null;end;
 execute 'reset role';
 -- Alteração posterior invalida a declaração; PCM pode conferir novamente.
 update pcm.ocorrencias_preventivas set vencimento=vencimento+1 where id=l;
 begin
  perform pcm.sso_indice_legado_reservado_sso('16630000-1111-4000-8000-000000000097',1);
  raise exception 'fotografia_antiga_aceita';
 exception when check_violation then if sqlerrm<>'efeito_legado_exige_reconciliacao' then raise;end if;end;
 execute 'set local role authenticated';
 f:=pcm.sso_prever_reconciliacao_legada_sso('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',l,'17240000-1111-4000-8000-000000000031')->'foto';
 perform pcm.sso_reconciliar_legada_sso('16630000-1111-4000-8000-000000000001','17290000-1111-4000-8000-000000000002','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',l,'17240000-1111-4000-8000-000000000031','Conferido novamente',f);
 select estado into strict est from pcm.sso_estados_legadas_inertes('16630000-1111-4000-8000-00000000000a',array[l]);
 if est<>'substituida' then raise exception 'reconferencia_nao_aplicada';end if;
 execute 'reset role';
 if (select count(*) from pcm.sso_declaracoes_legada_inerte where legada_id=l)<>2 then raise exception 'historico_perdido';end if;
 update pcm.ocorrencias_preventivas set vencimento=vencimento-1 where id=l;
 begin
  perform pcm.sso_indice_legado_reservado_sso('16630000-1111-4000-8000-000000000097',1);
  raise exception 'declaracao_antiga_ressuscitou';
 exception when check_violation then if sqlerrm<>'efeito_legado_exige_reconciliacao' then raise;end if;end;
 update pcm.ocorrencias_preventivas set vencimento=vencimento+1 where id=l;
 begin update pcm.ocorrencias_preventivas set envio_estado='enviando' where id=l;raise exception 'envio_indevido';exception when check_violation then null;end;
end; $$;
do $$ begin
 if pcm.sso_indice_legado_reservado_sso('16630000-1111-4000-8000-000000000097',1) is distinct from true then raise exception 'escolha_nova_nao_aplicada';end if;
end; $$;
-- Preparação e Chamado SSO usam execução real após a vigência, sem Auvo.
-- Relógio de geração é simulado para dentro de sua janela civil de 30 dias.
create or replace function pcm.sso_data_civil_versao_geracao(p_plano_id uuid,p_versao_id uuid)
returns date language sql stable security definer set search_path='' as $$ select pcm.sso_vencimento_ciclo_calendario(current_date,1,'meses',1) $$;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16630000-1111-4000-8000-000000000001','chamado.os.criar','16630000-1111-4000-8000-00000000000a');
update pcm.sso_chamado_preventivo_gate set habilitado=true where id;
create temporary table sso_data_supersessao_fixture as select pcm.sso_vencimento_ciclo_calendario(current_date,1,'meses',1) data;
grant select on sso_data_supersessao_fixture to authenticated;
set local role authenticated;
do $$ declare d date;a jsonb;b jsonb;c jsonb;begin
 select data into strict d from sso_data_supersessao_fixture;
 a:=pcm.sso_materializar_ciclo_canonico('17240000-1111-4000-8000-000000000041','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','17240000-1111-4000-8000-000000000021','17240000-1111-4000-8000-000000000034',2,d);
 b:=pcm.sso_materializar_ciclo_canonico('17240000-1111-4000-8000-000000000041','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','17240000-1111-4000-8000-000000000021','17240000-1111-4000-8000-000000000034',2,d);
 if a is distinct from b then raise exception 'preparacao_replay_divergente';end if;
 c:=pcm.sso_criar_chamado_ciclo_preventivo('17240000-1111-4000-8000-000000000042','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',(a->>'preparadaId')::uuid);
 if c->>'osCriada'<>'false' or c->>'tarefaAuvoCriada'<>'false' then raise exception 'efeito_nao_autorizado';end if;
end; $$;
reset role;
-- Fonte modificada após selagem exige reconciliação e não reescreve histórico.
update pcm.planos_preventivos set fuso='UTC' where id='16630000-1111-4000-8000-000000000097';
do $$ begin
 begin
  perform pcm.sso_indice_legado_reservado_sso('16630000-1111-4000-8000-000000000097',1);
  raise exception 'fonte_alterada_aceita';
 exception when check_violation then if sqlerrm<>'reserva_origem_obsoleta' then raise;end if;end;
end; $$;
rollback;
