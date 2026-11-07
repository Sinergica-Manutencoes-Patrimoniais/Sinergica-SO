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
-- Ponte e avaliação criadas apenas como fixture; 1045 preservada.
set local session_replication_role=replica;
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values('16630000-1111-4000-8000-000000000710','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000033','16630000-1111-4000-8000-000000000711','16630000-1111-4000-8000-000000000712','Legado teste',current_date+10,'meses',1,'ativo','16630000-1111-4000-8000-000000000001');
insert into pcm.ocorrencias_preventivas(id,plano_id,indice,vencimento,chave_externa,envio_estado) values('16630000-1111-4000-8000-000000000713','16630000-1111-4000-8000-000000000710',0,current_date+10,'TESTE-1745','prevista');
insert into pcm.ocorrencias_rotina_vinculos(ocorrencia_preparada_id,ciclo_id,ocorrencia_legada_id,created_by) select o.id,'16630000-1111-4000-8000-000000000714','16630000-1111-4000-8000-000000000713','16630000-1111-4000-8000-000000000001' from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.sso_declaracoes_planos_legados(request_id,cliente_id,plano_id,plano_legado_id,revisao,decisao,motivo,ator_id,payload,resultado) values ('16630000-1111-4000-8000-000000000719','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000710',1,'declarar','fixture','16630000-1111-4000-8000-000000000001','{}','{}');
set local session_replication_role=origin;
set local session_replication_role=replica;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id) values('16630000-1111-4000-8000-000000000717','16630000-1111-4000-8000-00000000000a','OS-AC5','OS aberta sintética','preventiva','16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000713');
set local session_replication_role=origin;
create temporary table os_ac5 as select status,updated_at from pcm.ordens_servico where id='16630000-1111-4000-8000-000000000717';
-- Exercita tentativa de substituir alvo diferente; alteração só da fixture.
set local session_replication_role=replica;
update pcm.rotinas_manutencao set sistema_id='16630000-1111-4000-8000-000000000999', intervalo_n=2 where versao_id='16630000-1111-4000-8000-000000000022';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare p uuid;f jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,null,20) limit 1;
 f:=pcm.sso_comparar_rotina_impacto_v3('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,'16630000-1111-4000-8000-000000000022',p,'calendario');
 if jsonb_array_length(f->'osImpacto')<>1 or (f->'rascunho'->>'intervalo_n')::int<>2 then raise exception 'os_ou_recorrencia_nao_exibida';end if;
 begin perform pcm.sso_escolher_nova_data_calendario('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000721','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,3,2,0,current_date+11,'Conferido',f);raise exception 'alvo_diferente_aceito';exception when check_violation then if sqlerrm<>'identidade_ou_alvo_incompativel' then raise;end if;end;
end $$;
reset role;
set local session_replication_role=replica;
update pcm.rotinas_manutencao set sistema_id='16630000-1111-4000-8000-000000000033', intervalo_n=1 where versao_id='16630000-1111-4000-8000-000000000022';
set local session_replication_role=origin;
set local role authenticated;
do $$ begin
 begin perform pcm.sso_aprovar_revisao_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011',current_date+1); raise exception 'aprovacao_aceitou_avaliacao';
 exception when check_violation then if sqlerrm<>'comparacao_os_obsoleta' then raise;end if;end;
end $$;
reset role;
do $$ begin if not exists(select 1 from pcm.ordens_servico o cross join os_ac5 a where o.id='16630000-1111-4000-8000-000000000717' and o.status is not distinct from a.status and o.updated_at is not distinct from a.updated_at) then raise exception 'os_modificada';end if;end $$;
set local session_replication_role=replica;
delete from pcm.ordens_servico where id='16630000-1111-4000-8000-000000000717';
set local session_replication_role=origin;
-- Remove apenas fontes sintéticas para recuperar o cenário positivo anterior.
set local session_replication_role=replica;
delete from pcm.ocorrencias_rotina_vinculos where ocorrencia_legada_id='16630000-1111-4000-8000-000000000713';
delete from pcm.sso_declaracoes_planos_legados where request_id='16630000-1111-4000-8000-000000000719';
delete from pcm.ocorrencias_preventivas where id='16630000-1111-4000-8000-000000000713';
delete from pcm.planos_preventivos where id='16630000-1111-4000-8000-000000000710';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aprovar_revisao_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011',current_date+1);
 b:=pcm.sso_aprovar_revisao_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000706',3,'16630000-1111-4000-8000-000000000011',current_date+1);
 if a is distinct from b or a->>'state'<>'aprovado' then raise exception 'aprovacao_replay_incorreto';end if;
end $$;
rollback;
