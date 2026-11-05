-- Ensaio AC3 em clone; setup sintético, comandos reais e ROLLBACK.
begin;
set local app.auvo_sync_write='true';
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16660000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','s166-mediador@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16660000-0000-0000-0000-000000000001','superadmin','Teste',true);
insert into pcm.clientes(id,nome,ativo,created_by) values ('16660000-0000-0000-0000-00000000000a','Cliente teste',true,'16660000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16660000-0000-0000-0000-000000000001','plano.gerir','16660000-0000-0000-0000-00000000000a'),('16660000-0000-0000-0000-000000000001','visita.confirmar','16660000-0000-0000-0000-00000000000a');
insert into comercial.etapas_funil(id,nome,ordem,cor) values ('16660000-0000-0000-0000-000000000030','Etapa teste',1,'#000');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('16660000-0000-0000-0000-000000000031','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000030','Teste');
insert into comercial.propostas(id,oportunidade_id,tipo) values ('16660000-0000-0000-0000-000000000032','16660000-0000-0000-0000-000000000031','volante');
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio) values ('16660000-0000-0000-0000-000000000033','16660000-0000-0000-0000-000000000032','16660000-0000-0000-0000-00000000000a','volante','2026-01-01');
insert into pcm.calendario_contratual_series(id,cliente_id,contrato_id,created_by) values ('16660000-0000-0000-0000-000000000020','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000033','16660000-0000-0000-0000-000000000001');
insert into pcm.regras_visita_contratual(id,serie_id,numero,ancora_semana,dia_semana,intervalo_semanas,hora_inicio,duracao_minutos,fuso,vigencia_inicio,created_by) values ('16660000-0000-0000-0000-000000000021','16660000-0000-0000-0000-000000000020',1,'2026-10-05',5,1,'08:00',120,'UTC','2026-01-01','16660000-0000-0000-0000-000000000001');

update pcm.sso_mudanca_dia_atomica_gate set habilitado=true where id;
update pcm.calendario_alteracao_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16660000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
-- Uma Visita regular móvel; uma confirmada, uma extra e uma reprogramada preservadas.
set local session_replication_role=replica;
insert into pcm.visitas(id,cliente_id,contrato_id,inicio_em,fim_em,fuso,natureza,estado,created_by)
select x.id::uuid,'16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000033',
 (date_trunc('week',current_date+21)::date+x.deslocamento+time '08:00') at time zone 'UTC',
 (date_trunc('week',current_date+21)::date+x.deslocamento+time '10:00') at time zone 'UTC',
 'UTC',x.natureza,x.estado,'16660000-0000-0000-0000-000000000001'
from (values ('17320000-0000-0000-0000-000000000001',4,'regular','planejada'),('17320000-0000-0000-0000-000000000002',11,'regular','confirmada'),('17320000-0000-0000-0000-000000000003',4,'extra','planejada'),('17320000-0000-0000-0000-000000000004',18,'regular','planejada'),('17320000-0000-0000-0000-000000000010',25,'regular','planejada')) x(id,deslocamento,natureza,estado);
insert into pcm.visita_origem_contratual(visita_id,cliente_id,contrato_id,serie_id,regra_id,semana_origem,registrado_por)
select v.id,v.cliente_id,v.contrato_id,'16660000-0000-0000-0000-000000000020','16660000-0000-0000-0000-000000000021',date_trunc('week',v.inicio_em)::date,'16660000-0000-0000-0000-000000000001' from pcm.visitas v where v.id in ('17320000-0000-0000-0000-000000000001','17320000-0000-0000-0000-000000000002','17320000-0000-0000-0000-000000000004','17320000-0000-0000-0000-000000000010');
insert into pcm.visita_transicoes_historico(visita_id,revisao,acao,motivo,inicio_anterior,fim_anterior,inicio_novo,fim_novo,estado_anterior,estado_novo,request_id,ator_id)
select id,2,'reprogramar','fixture',inicio_em-interval '1 day',fim_em-interval '1 day',inicio_em,fim_em,'planejada','planejada','17320000-0000-0000-0000-000000000005','16660000-0000-0000-0000-000000000001' from pcm.visitas where id='17320000-0000-0000-0000-000000000004';
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,auvo_task_id,created_by)
values('17320000-0000-0000-0000-000000000008','16660000-0000-0000-0000-00000000000a','TESTE-1732','OS fixture','preventiva',17320008,'16660000-0000-0000-0000-000000000001');
insert into pcm.visita_ordens_servico(id,visita_id,os_id,cliente_id,sequencia,created_by)
values('17320000-0000-0000-0000-000000000009','17320000-0000-0000-0000-000000000002','17320000-0000-0000-0000-000000000008','16660000-0000-0000-0000-00000000000a',1,'16660000-0000-0000-0000-000000000001');
set local session_replication_role=origin;
create temporary table os_antes_1732 as select to_jsonb(o) foto from pcm.ordens_servico o where id='17320000-0000-0000-0000-000000000008';
create temporary table visitas_antes_1732 as select id,to_jsonb(v) foto from pcm.visitas v where id in ('17320000-0000-0000-0000-000000000002','17320000-0000-0000-0000-000000000003','17320000-0000-0000-0000-000000000004','17320000-0000-0000-0000-000000000010');
-- RPCs mediadas concedidas apenas a authenticated; gate nasce false.
set local role authenticated;
do $$ begin
 begin perform pcm.sso_aprovar_excecao_visita('16660000-0000-0000-0000-000000000001','17320000-0000-0000-0000-000000000011','16660000-0000-0000-0000-00000000000a','17320000-0000-0000-0000-000000000010',1,date_trunc('week',current_date+21)::date+25,'PCM','ajuste','Conferido');raise exception 'gate_aberto';exception when sqlstate '55000' then null;end;
end $$;
reset role;
update pcm.sso_excecao_visita_gate set habilitado=true where id;
set local role authenticated;
do $$ declare r jsonb;begin
 r:=pcm.sso_consultar_excecao_visita('16660000-0000-0000-0000-000000000001','16660000-0000-0000-0000-00000000000a','17320000-0000-0000-0000-000000000010');
 if r->>'aprovada'<>'false' or r->>'revisaoAtual'<>'1' or (r->>'dataAtual')::date<>date_trunc('week',current_date+21)::date+25 then raise exception 'leitura_inicial_divergente';end if;
end $$;
do $$ begin
 begin perform pcm.sso_aprovar_excecao_visita('16660000-0000-0000-0000-000000000001','17320000-0000-0000-0000-000000000012','16660000-0000-0000-0000-00000000000b','17320000-0000-0000-0000-000000000010',1,date_trunc('week',current_date+21)::date+25,'PCM','ajuste','Conferido');raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
 begin perform pcm.sso_aprovar_excecao_visita('16660000-0000-0000-0000-000000000001','17320000-0000-0000-0000-000000000013','16660000-0000-0000-0000-00000000000a','17320000-0000-0000-0000-000000000010',2,date_trunc('week',current_date+21)::date+25,'PCM','ajuste','Conferido');raise exception 'revisao_obsoleta_aceita';exception when serialization_failure then null;end;
end $$;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_aprovar_excecao_visita('16660000-0000-0000-0000-000000000001','17320000-0000-0000-0000-000000000011','16660000-0000-0000-0000-00000000000a','17320000-0000-0000-0000-000000000010',1,date_trunc('week',current_date+21)::date+25,'PCM','ajuste','Conferido');
 b:=pcm.sso_aprovar_excecao_visita('16660000-0000-0000-0000-000000000001','17320000-0000-0000-0000-000000000011','16660000-0000-0000-0000-00000000000a','17320000-0000-0000-0000-000000000010',1,date_trunc('week',current_date+21)::date+25,'PCM','ajuste','Conferido');
 if a is distinct from b then raise exception 'replay_divergente';end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','pcm.sso_aprovar_excecao_visita(uuid,uuid,uuid,uuid,integer,date,text,text,text)','execute') or has_function_privilege('anon','pcm.sso_consultar_excecao_visita(uuid,uuid,uuid)','execute') then raise exception 'anon_autorizado';end if;
end $$;
update config.sso_concessoes set ativa=false where usuario_id='16660000-0000-0000-0000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ begin
 begin perform pcm.sso_aprovar_excecao_visita('16660000-0000-0000-0000-000000000001','17320000-0000-0000-0000-000000000011','16660000-0000-0000-0000-00000000000a','17320000-0000-0000-0000-000000000010',1,date_trunc('week',current_date+21)::date+25,'PCM','ajuste','Conferido');raise exception 'replay_revogado_aceito';exception when insufficient_privilege then null;end;
 begin perform pcm.sso_consultar_excecao_visita('16660000-0000-0000-0000-000000000001','16660000-0000-0000-0000-00000000000a','17320000-0000-0000-0000-000000000010');raise exception 'leitura_revogada_aceita';exception when insufficient_privilege then null;end;
end $$;
reset role;
update config.sso_concessoes set ativa=true where usuario_id='16660000-0000-0000-0000-000000000001' and acao='plano.gerir';
update pcm.sso_excecao_visita_gate set habilitado=false where id;
update pcm.sso_previa_mudanca_dia_gate set habilitado=true where id;
set local role authenticated;
do $$ declare estado jsonb;begin
 estado:=pcm.sso_consultar_excecao_visita('16660000-0000-0000-0000-000000000001','16660000-0000-0000-0000-00000000000a','17320000-0000-0000-0000-000000000010');
 if estado->>'aprovada' is distinct from 'true' then raise exception 'leitura_historica_indisponivel';end if;
end $$;
do $$ declare v text;begin
 select classificacao into strict v from pcm.sso_prever_mudanca_dia('16660000-0000-0000-0000-000000000001','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000020',1,current_date+1,2,null,null,100) where visita_id='17320000-0000-0000-0000-000000000010';
 if v<>'preservar_e_conferir' then raise exception 'previa_nao_preservou: %',v;end if;
end $$;
select pcm.sso_alterar_dia_com_visitas('17320000-0000-0000-0000-000000000006','16660000-0000-0000-0000-000000000001','16660000-0000-0000-0000-00000000000a','16660000-0000-0000-0000-000000000020','17320000-0000-0000-0000-000000000007',1,2,current_date+1,'[{"visitaId":"17320000-0000-0000-0000-000000000001","revisao":1}]');
reset role;
do $$ begin
 if (select (inicio_em at time zone 'UTC')::date from pcm.visitas where id='17320000-0000-0000-0000-000000000001') is distinct from date_trunc('week',current_date+21)::date+1 then raise exception 'visita_nao_movida';end if;
 if exists(select 1 from visitas_antes_1732 a join pcm.visitas v on v.id=a.id where a.foto is distinct from to_jsonb(v)) then raise exception 'historico_ou_visita_preservada_alterada';end if;
 if (select count(*) from pcm.visita_transicoes_historico where visita_id='17320000-0000-0000-0000-000000000004')<>1 then raise exception 'historico_removido';end if;
 if (select foto from os_antes_1732) is distinct from (select to_jsonb(o) from pcm.ordens_servico o where id='17320000-0000-0000-0000-000000000008') then raise exception 'os_ou_id_auvo_alterado';end if;
end $$;
rollback;
