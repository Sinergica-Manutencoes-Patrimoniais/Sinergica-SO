-- Clone sintético até 1701, BEGIN/ROLLBACK; selo e versão são fixture, sem Auvo.
\ir manual_E01-S165_S166_continuidade_calendario.sql
reset role;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16630000-1111-4000-8000-000000000001','chamado.os.criar','16630000-1111-4000-8000-00000000000a');
update pcm.sso_chamado_preventivo_gate set habilitado=true where id;
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,nome}',to_jsonb('Rotina histórica'::text),true) where id='16630000-1111-4000-8000-000000000021';
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,nome}',to_jsonb('Rotina operacional'::text),true) where id='16630000-1111-4000-8000-000000000022';
insert into pcm.sso_versoes_operacionais_ciclo(tipo,cliente_id,plano_id,preparada_id,versao_id,rotina_id,vigencia,decisao_request_id)
 select 'calendario','16630000-1111-4000-8000-00000000000a',o.plano_id,o.id,'16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000034',current_date,'16630000-1111-4000-8000-000000000056' from pcm.ocorrencias_rotina_preparadas o where o.plano_id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
create temporary table fixture1701 as select preparada_id from pcm.sso_ciclo_canonico_usos_versao where versao_id='16630000-1111-4000-8000-000000000022' limit 1;
grant select on fixture1701 to authenticated;
set local role authenticated;
do $$ declare a jsonb;b jsonb;p uuid;begin
 select preparada_id into p from fixture1701;
 a:=pcm.sso_criar_chamado_ciclo_preventivo('16630000-1111-4000-8000-000000000911','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',p);
 b:=pcm.sso_criar_chamado_ciclo_preventivo('16630000-1111-4000-8000-000000000911','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',p);
 if a is distinct from b or a->>'osCriada'<>'false' or a->>'tarefaAuvoCriada'<>'false' then raise exception 'chamado_replay_divergente';end if;
end; $$;
reset role;
do $$ declare c uuid;begin
 select chamado_id into c from pcm.sso_chamados_ciclo_preventivo where plano_id='16630000-1111-4000-8000-000000000011';
 if (select titulo from pcm.chamados where id=c) is distinct from 'Preventiva: Rotina operacional' then raise exception 'nome_operacional_incorreto';end if;
 -- INSERT real de OS com gatilhos ativos, como o adapter, mas executado pelo owner da fixture.
 insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,origem,created_by,chamado_id)
 values ('16630000-1111-4000-8000-000000000912','16630000-1111-4000-8000-00000000000a','OS-1701-FIX','OS sintética','preventiva','manual','16630000-1111-4000-8000-000000000001',c);
 if (select versao_id from pcm.sso_origens_os_preventiva where os_id='16630000-1111-4000-8000-000000000912') is distinct from '16630000-1111-4000-8000-000000000022'::uuid then raise exception 'fotografia_incorreta';end if;
 if (select versao_id from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011') is distinct from '16630000-1111-4000-8000-000000000021'::uuid then raise exception 'origem_alterada';end if;
end; $$;
