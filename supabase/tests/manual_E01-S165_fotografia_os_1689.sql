-- Clone isolado em BEGIN/ROLLBACK; selos e Chamados são sintéticos.
\ir manual_E01-S165_S166_continuidade_calendario.sql
reset role;
update pcm.sso_chamado_preventivo_gate set habilitado=true where id;
set local session_replication_role=replica;
insert into pcm.chamados(id,numero,cliente_id,titulo,created_by) values
 ('16630000-1111-4000-8000-000000000901','CH-1689-A','16630000-1111-4000-8000-00000000000a','Chamado antigo','16630000-1111-4000-8000-000000000001'),
 ('16630000-1111-4000-8000-000000000902','CH-1689-B','16630000-1111-4000-8000-00000000000a','Chamado novo','16630000-1111-4000-8000-000000000001');
insert into pcm.sso_chamados_ciclo_preventivo(ciclo_id,cliente_id,plano_id,preparada_id,chamado_id,ator_id)
select '16630000-1111-4000-8000-000000000903','16630000-1111-4000-8000-00000000000a',o.plano_id,o.id,'16630000-1111-4000-8000-000000000901','16630000-1111-4000-8000-000000000001' from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.sso_chamados_ciclo_preventivo(ciclo_id,cliente_id,plano_id,preparada_id,chamado_id,ator_id)
select '16630000-1111-4000-8000-000000000904','16630000-1111-4000-8000-00000000000a',o.plano_id,o.id,'16630000-1111-4000-8000-000000000902','16630000-1111-4000-8000-000000000001' from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,origem,created_by,chamado_id) values ('16630000-1111-4000-8000-000000000905','16630000-1111-4000-8000-00000000000a','OS-1689-A','OS antiga','preventiva','manual','16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000901');
insert into pcm.sso_versoes_operacionais_ciclo(tipo,cliente_id,plano_id,preparada_id,versao_id,rotina_id,vigencia,decisao_request_id)
select 'calendario','16630000-1111-4000-8000-00000000000a',o.plano_id,o.id,'16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000034',current_date,'16630000-1111-4000-8000-000000000092' from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,origem,created_by,chamado_id) values ('16630000-1111-4000-8000-000000000906','16630000-1111-4000-8000-00000000000a','OS-1689-B','OS nova','preventiva','manual','16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000902');
update pcm.ordens_servico set questionario_id=questionario_id where id='16630000-1111-4000-8000-000000000905';
do $$ begin
 if (select versao_id from pcm.sso_origens_os_preventiva where os_id='16630000-1111-4000-8000-000000000905') is distinct from '16630000-1111-4000-8000-000000000021'::uuid then raise exception 'os_antiga_versao_incorreta';end if;
 if (select versao_id from pcm.sso_origens_os_preventiva where os_id='16630000-1111-4000-8000-000000000906') is distinct from '16630000-1111-4000-8000-000000000022'::uuid then raise exception 'os_nova_versao_incorreta';end if;
end; $$;
