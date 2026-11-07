begin;
-- Clone descartável, BEGIN/ROLLBACK. Exceção da função 1045 SOMENTE nesta transação;
-- não prova segurança integral nem autoriza homologação. Demais validadores permanecem ativos.
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
-- Nova escolha de reserva em rascunho, após submissão, com APIs autenticadas.
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
insert into pcm.tipos_tarefa(id,nome,auvo_id,created_by,updated_by) values ('17220000-1111-4000-8000-000000000096','Tipo sintético 1722',172200096,'16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000001');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values ('17220000-1111-4000-8000-000000000097','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000033','16630000-1111-4000-8000-000000000706','17220000-1111-4000-8000-000000000096','Legado sintético 1722',pcm.sso_vencimento_ciclo_calendario(current_date+11,1,'meses',1),'meses',1,'ativo','16630000-1111-4000-8000-000000000001');
create temporary table sso_rotina_rascunho_1722 as select id from pcm.rotinas_manutencao where versao_id='16630000-1111-4000-8000-000000000022';
grant select on sso_rotina_rascunho_1722 to authenticated;
set local role authenticated;
select pcm.sso_declarar_relacao_legada_mediada('16630000-1111-4000-8000-000000000001','17220000-1111-4000-8000-000000000098','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','17220000-1111-4000-8000-000000000097',0,'declarar','Relação sintética');
do $$ declare r uuid;f jsonb;a jsonb;b jsonb;begin
 select id into strict r from sso_rotina_rascunho_1722;
 f:=pcm.sso_prever_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',r,1,'17220000-1111-4000-8000-000000000097',0,3)->'foto';
 a:=pcm.sso_escolher_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','17220000-1111-4000-8000-000000000031','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',r,1,'17220000-1111-4000-8000-000000000097',0,3,0,'somente_sso',true,'Escolha sintética',f);
 b:=pcm.sso_escolher_reserva_calendario_rascunho('16630000-1111-4000-8000-000000000001','17220000-1111-4000-8000-000000000031','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',r,1,'17220000-1111-4000-8000-000000000097',0,3,0,'somente_sso',true,'Escolha sintética',f);
 if a is distinct from b or a->>'selada'<>'false' then raise exception 'escolha_replay_divergente';end if;
end; $$;
reset role;
-- Simula apenas a exceção da 1045; trigger continua habilitado e definição volta no ROLLBACK.
create or replace function pcm.sso_bloquear_aprovacao_impacto_indeterminado() returns trigger language plpgsql security definer set search_path='' as $$ begin return new;end; $$;
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

-- Selo criado pela aprovação mediada real; a 1045 foi simulada apenas neste BEGIN/ROLLBACK.
do $$ begin
 if not exists(select 1 from pcm.sso_selos_reserva_futura_rascunho where escolha_request_id='17220000-1111-4000-8000-000000000031' and versao_id='16630000-1111-4000-8000-000000000022') then raise exception 'selo_rascunho_ausente';end if;
 if pcm.sso_indice_legado_reservado_sso('17220000-1111-4000-8000-000000000097',0) is distinct from false then raise exception 'efeito_antes_vigencia';end if;
end; $$;
-- Avanço civil simulado somente na transação descartável.
create or replace function pcm.sso_data_civil_transicao_plano(p_plano uuid,p_versao uuid,p_vigencia date)
returns date language sql volatile security definer set search_path='' as $$ select current_date+1 $$;
do $$ begin
 if pcm.sso_indice_legado_reservado_sso('17220000-1111-4000-8000-000000000097',0) is distinct from true then raise exception 'escolha_nao_ativada';end if;
end; $$;

-- Geração real após vigência simulada; 1045 continua simulada nesta transação.
-- A data escolhida fica além da janela de 30 dias no setup; simular +20 dias também
-- para a função de geração, somente nesta transação descartável.
do $$ declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_data_civil_versao_geracao(uuid,uuid)'::regprocedure);a text:=$a$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date;$a$;b text:=$b$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date+20;$b$;begin if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'relogio_fixture_incompativel';end if;execute replace(d,a,b);end; $$;
create temporary table geracao1728 as select p.revisao,r.id rotina,(select data_sso from pcm.sso_escolhas_reserva_futura_rascunho where request_id='17220000-1111-4000-8000-000000000031') vencimento from pcm.planos_manutencao p join pcm.rotinas_manutencao r on r.plano_id=p.id and r.versao_id='16630000-1111-4000-8000-000000000022' where p.id='16630000-1111-4000-8000-000000000011';
grant select on geracao1728 to authenticated;
set local role authenticated;
do $$ declare a jsonb;b jsonb;rev integer;rot uuid;v_data date;begin
 select revisao,rotina,vencimento into strict rev,rot,v_data from geracao1728;
 a:=pcm.sso_materializar_ciclo_canonico('17280000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',rot,rev,v_data);
 b:=pcm.sso_materializar_ciclo_canonico('17280000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',rot,rev,v_data);
 if a is distinct from b or a->>'osCriada'<>'false' then raise exception 'geracao_calendario_ou_replay_divergente: %',a;end if;
end; $$;
reset role;
do $$ begin
 if not exists(select 1 from pcm.sso_selos_reserva_futura_rascunho s join pcm.sso_ciclo_calendario_versoes c on c.ciclo_id=s.ciclo_id where s.escolha_request_id='17220000-1111-4000-8000-000000000031') then raise exception 'ciclo_nao_reutilizou_selo';end if;
end; $$;
rollback;
