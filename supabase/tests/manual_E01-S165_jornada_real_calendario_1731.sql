-- 1045 real; gate 1731 e relógio apenas em transação revertida. Fila e ponte sintéticas.
-- Clone descartável, BEGIN/ROLLBACK. Trigger 1045 real; gate dedicado ativado apenas na transação.
-- Não prova segurança integral nem autoriza homologação.
begin;
\ir manual_E01-S165_nova_data_futura_1702.sql
reset role;
-- A base mantém fim sintético fechado; abrir apenas neste clone para exercitar a revisão.
set local session_replication_role=replica;
update pcm.plano_versoes set vigencia_fim=null where id='16630000-1111-4000-8000-000000000021';
set local session_replication_role=origin;
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
update pcm.aprovacao_revisao_gate set habilitado=true where id;
update pcm.sso_aprovacao_revisao_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
insert into pcm.sso_fusos_plano_declarados(request_id,cliente_id,plano_id,revisao,fuso,fonte,motivo,ator_id,payload,resultado) values ('16630000-1111-4000-8000-000000000704','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',1,'UTC','fixture','fixture','16630000-1111-4000-8000-000000000001','{}','{}');
set local role authenticated;
select pcm.sso_classificar_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000705','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000043',3,0,'nao_relacionado','documento','obrigação distinta',(select fotografia from pcm.sso_listar_inventario_pmoc_revisao('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,null,20)));
reset role;
-- Ativa somente no clone o gate dedicado; 1045 não é simulada.
update pcm.sso_protocolo_revisao_1731_gate set habilitado=true where id;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aprovar_revisao_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011',current_date+1);
 b:=pcm.sso_aprovar_revisao_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011',current_date+1);
 if a is distinct from b or a->>'state'<>'aprovado' then raise exception 'aprovacao_replay_divergente';end if;
end; $$;
reset role;
do $$ begin
 if not exists(select 1 from pcm.sso_substituicoes_calendario_aprovadas where escolha_request_id='16630000-1111-4000-8000-000000000702' and versao_id='16630000-1111-4000-8000-000000000022') then raise exception 'selo_ausente';end if;
end; $$;


reset role;
create or replace function pcm.sso_data_civil_versao_geracao(p_plano_id uuid,p_versao_id uuid) returns date language plpgsql stable security definer set search_path='' as $$ begin return current_date+1;end; $$;
update pcm.sso_estado_ocorrencia_vinculada_gate set habilitado=true where id;
-- A ponte e fila históricas são sintéticas. Não se simula nenhuma OS ou envio.
set local session_replication_role=replica;
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by)
 values('16630000-1111-4000-8000-000000000710','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000033','16630000-1111-4000-8000-000000000711','16630000-1111-4000-8000-000000000712','Legado sintético',current_date+10,'meses',1,'ativo','16630000-1111-4000-8000-000000000001');
insert into pcm.ocorrencias_preventivas(id,plano_id,indice,vencimento,chave_externa,envio_estado)
 values('16630000-1111-4000-8000-000000000713','16630000-1111-4000-8000-000000000710',0,current_date+10,'TESTE-1702','prevista');
insert into pcm.ocorrencias_rotina_vinculos(ocorrencia_preparada_id,ciclo_id,ocorrencia_legada_id,created_by)
 select o.id,'16630000-1111-4000-8000-000000000714','16630000-1111-4000-8000-000000000713','16630000-1111-4000-8000-000000000001' from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.sso_fila_preventiva_pcm(ciclo_id,cliente_id,plano_id,preparada_id,estado,revisao)
 select cv.ciclo_id,'16630000-1111-4000-8000-00000000000a',o.plano_id,o.id,'aguardando',1 from pcm.ocorrencias_rotina_preparadas o join pcm.sso_ciclo_calendario_versoes cv on cv.preparada_id=o.id where o.plano_id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
select set_config('teste1702.revisao',(select revisao::text from pcm.planos_manutencao where id='16630000-1111-4000-8000-000000000011'),true);
select set_config('teste1702.rotina',(select rotina_id::text from pcm.sso_escolhas_nova_data_calendario where request_id='16630000-1111-4000-8000-000000000702'),true);
set local role authenticated;
do $$ begin
 begin perform pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000715','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',current_setting('teste1702.rotina')::uuid,current_setting('teste1702.revisao')::integer,current_date+11);raise exception 'geracao_antes_fila_aceita';exception when check_violation then if sqlerrm<>'fila_anterior_exige_reconciliacao' then raise;end if;end;
end; $$;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aplicar_retiradas_fila('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000716','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',50,null,null);
 b:=pcm.sso_aplicar_retiradas_fila('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000716','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',50,null,null);
 if a is distinct from b or (a->>'canceladas')::integer<>1 then raise exception 'retirada_ou_replay_divergente: %',a;end if;
end; $$;
reset role;
-- OS sintética tardia para verificar fonte legada; inserida como fixture, nunca enviada ao Auvo.
set local session_replication_role=replica;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id)
 values('16630000-1111-4000-8000-000000000717','16630000-1111-4000-8000-00000000000a','OS-1702','OS sintética','preventiva','16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000713');
set local session_replication_role=origin;
create temporary table os_1702_original as select status,updated_at from pcm.ordens_servico where id='16630000-1111-4000-8000-000000000717';
set local role authenticated;
do $$ begin
 begin perform pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000715','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',current_setting('teste1702.rotina')::uuid,current_setting('teste1702.revisao')::integer,current_date+11);raise exception 'os_antiga_ignorada';exception when check_violation then if sqlerrm<>'execucao_anterior_exige_reconciliacao' then raise;end if;end;
end; $$;
reset role;
do $$ begin if not exists(select 1 from pcm.ordens_servico os cross join os_1702_original anterior where os.id='16630000-1111-4000-8000-000000000717' and os.status is not distinct from anterior.status and os.updated_at is not distinct from anterior.updated_at) then raise exception 'os_historica_alterada';end if;end; $$;
-- Remover apenas OS sintética para ensaiar o ramo sem vínculo; o rollback descartará tudo.
set local session_replication_role=replica;
delete from pcm.ordens_servico where id='16630000-1111-4000-8000-000000000717';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000715','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',current_setting('teste1702.rotina')::uuid,current_setting('teste1702.revisao')::integer,current_date+11);
 b:=pcm.sso_materializar_ciclo_canonico('16630000-1111-4000-8000-000000000715','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',current_setting('teste1702.rotina')::uuid,current_setting('teste1702.revisao')::integer,current_date+11);
 if a is distinct from b or a->>'vencimentoOriginal' is distinct from (current_date+11)::text or a->>'osCriada'<>'false' then raise exception 'geracao_ou_replay_divergente: %',a;end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_substituicoes_calendario_materializadas where escolha_request_id='16630000-1111-4000-8000-000000000702')<>1 then raise exception 'substituicao_nao_vinculada';end if;
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011')<>2 then raise exception 'quantidade_ocorrencias_incorreta';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16630000-1111-4000-8000-00000000000a') then raise exception 'os_indevida';end if;
end; $$;

rollback;
