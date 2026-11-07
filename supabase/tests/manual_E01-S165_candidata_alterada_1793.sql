-- P0020 com aprovação real, guardas ativas, origem/Visitas por RPC e relógio civil simulado +1 dia.
-- Apenas clone descartável; BEGIN/ROLLBACK; não comprova relógio real nem fonte externa.
-- E01-S165: fundação isolada de rascunho; fixtures sintéticas, sem envio Auvo.
begin;
set local app.auvo_sync_write = 'true';
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
 ('16500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gestor-s165@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now()),
 ('16500000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sem-plano-s165@test.local', crypt('x', gen_salt('bf')), '{}', '{}', now(), now());
insert into config.usuarios(user_id, papel, nome, ativo) values
 ('16500000-0000-0000-0000-000000000001', 'superadmin', 'Gestor S165', true),
 ('16500000-0000-0000-0000-000000000002', 'superadmin', 'Sem concessão S165', true);
insert into pcm.clientes(id, nome, ativo, created_by) values
 ('16500000-0000-0000-0000-00000000000a', 'Cliente A S165', true, '16500000-0000-0000-0000-000000000001'),
 ('16500000-0000-0000-0000-00000000000b', 'Cliente B S165', true, '16500000-0000-0000-0000-000000000001');
insert into config.sso_concessoes(usuario_id, acao, cliente_id) values
 ('16500000-0000-0000-0000-000000000001', 'plano.gerir', '16500000-0000-0000-0000-00000000000a');
insert into pcm.areas(id, cliente_id, nome) values ('16500000-0000-0000-0000-000000000021', '16500000-0000-0000-0000-00000000000a', 'Área A');
insert into pcm.locais(id, area_id, nome) values ('16500000-0000-0000-0000-000000000031', '16500000-0000-0000-0000-000000000021', 'Salão');
insert into pcm.equipamento_categorias(id, nome) values ('16500000-0000-0000-0000-000000000041', 'Categoria S165');
insert into pcm.questionarios(id, auvo_id, nome, perguntas, ativo) values ('16500000-0000-0000-0000-000000000091', 165000091, 'Inspeção S165', '[]', true);
insert into pcm.sistemas(id, cliente_id, nome) values
 ('16500000-0000-0000-0000-000000000051', '16500000-0000-0000-0000-00000000000a', 'Extintores'),
 ('16500000-0000-0000-0000-000000000052', '16500000-0000-0000-0000-00000000000b', 'Sistema B');
insert into pcm.equipamentos(id, client_id, nome) values ('16500000-0000-0000-0000-000000000061', '16500000-0000-0000-0000-00000000000a', 'QGBT');
insert into pcm.grupos_quantitativos(id, cliente_id, local_id, categoria_id, nome, quantidade, created_by, updated_by) values
 ('16500000-0000-0000-0000-000000000071', '16500000-0000-0000-0000-00000000000a', '16500000-0000-0000-0000-000000000031', '16500000-0000-0000-0000-000000000041', 'Luminárias', 20, '16500000-0000-0000-0000-000000000001', '16500000-0000-0000-0000-000000000001');
set local request.jwt.claims = '{"sub":"16500000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
select pcm.sso_salvar_plano_rascunho('16500000-0000-0000-0000-000000000501',0,'16500000-0000-0000-0000-000000000012','16500000-0000-0000-0000-00000000000a','Plano de aprovação');
reset role;
update pcm.sso_fuso_plano_gate set habilitado=true where id;
update pcm.sso_fuso_plano_mediado_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_declarar_fuso_mediado('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-000000000614','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000012',0,'America/Sao_Paulo',null,'Fixture','Declaração de teste');
select pcm.sso_adicionar_rotina_rascunho_v2('16500000-0000-0000-0000-000000000502',1,'16500000-0000-0000-0000-000000000012','16500000-0000-0000-0000-000000000089','Inspeção','sistema','16500000-0000-0000-0000-000000000051','visita',1,'semanas',null,45,0,0,'Inspecionar','16500000-0000-0000-0000-000000000091','total');
select pcm.sso_transicionar_revisao_plano('16500000-0000-0000-0000-000000000503',2,'16500000-0000-0000-0000-000000000012','submeter');
select pcm.sso_aprovar_plano('16500000-0000-0000-0000-000000000504',3,'16500000-0000-0000-0000-000000000012',current_date);
reset role;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16500000-0000-0000-0000-000000000001','visita.confirmar','16500000-0000-0000-0000-00000000000a');
insert into comercial.etapas_funil(id,nome,ordem,cor) values ('16500000-0000-0000-0000-000000000021','P0020',1,'#000');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('16500000-0000-0000-0000-000000000031','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000021','P0020');
insert into comercial.propostas(id,oportunidade_id,tipo) values ('16500000-0000-0000-0000-000000000041','16500000-0000-0000-0000-000000000031','volante');
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,vigencia_inicio) values ('16500000-0000-0000-0000-000000000051','16500000-0000-0000-0000-000000000041','16500000-0000-0000-0000-00000000000a','volante',current_date-30);
set local role authenticated;
select pcm.sso_criar_regra_contratual_v2('16500000-0000-0000-0000-000000000601',0,'16500000-0000-0000-0000-000000000064','16500000-0000-0000-0000-000000000076','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000051',date_trunc('week',current_date)::date,5,1,'08:00',120,30,'America/Sao_Paulo',current_date-1,null);
reset role;
update pcm.sso_geracao_ou_supressao_gate set habilitado=true where id;
update pcm.sso_geracao_com_supressao_gate set habilitado=true where id;
update pcm.sso_supressao_semana_gate set habilitado=true where id;
update pcm.sso_coordenacao_feriados_gate set habilitado=true where id;
update pcm.sso_acesso_geracao_visita_gate set habilitado=true where id;
update pcm.sso_gerar_visita_contratual_gate set habilitado=true where id;
update pcm.sso_origem_contratual_unica_gate set habilitado=true where id;
update pcm.feriado_declarado_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_gerar_visita_ou_suprimir('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-000000000602','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000064','16500000-0000-0000-0000-000000000076',date_trunc('week',current_date)::date+7,'16500000-0000-0000-0000-000000000081',((date_trunc('week',current_date)::date+11)::text||' 08:00 America/Sao_Paulo')::timestamptz,null,'Fonte sintética');
select pcm.sso_gerar_visita_ou_suprimir('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-000000000603','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000064','16500000-0000-0000-0000-000000000076',date_trunc('week',current_date)::date+14,'16500000-0000-0000-0000-000000000083',((date_trunc('week',current_date)::date+18)::text||' 08:00 America/Sao_Paulo')::timestamptz,null,'Fonte sintética');
reset role;
update pcm.ocorrencia_rotina_gate set habilitado=true where id;
select id as versao from pcm.plano_versoes where plano_id='16500000-0000-0000-0000-000000000012' and estado='aprovado' \gset
set local role authenticated;
select pcm.sso_vincular_serie_rotina_mediado('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000604','16500000-0000-0000-0000-000000000012',:'versao','16500000-0000-0000-0000-000000000089','16500000-0000-0000-0000-000000000064',4);
select pcm.sso_decidir_vigencia_serie_mediada('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000605','16500000-0000-0000-0000-000000000012','16500000-0000-0000-0000-000000000089','16500000-0000-0000-0000-000000000064','16500000-0000-0000-0000-000000000125',0,'criar',current_date,'Fixture');
reset role;
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
update pcm.sso_identidade_ciclo_visita_gate set habilitado=true where id;
update pcm.sso_materializar_visita_canonica_gate set habilitado=true where id;
update pcm.sso_origem_lote_gate set habilitado=true where id;
update pcm.sso_origem_rotina_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_declarar_origem_rotina('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-000000000607','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000012',:'versao','16500000-0000-0000-0000-000000000089',4,'plano','Fonte sintética',true);
select pcm.sso_preparar_visita_canonica('16500000-0000-0000-0000-000000000606','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000161','16500000-0000-0000-0000-000000000012',:'versao','16500000-0000-0000-0000-000000000089','16500000-0000-0000-0000-000000000081',4,'Fonte sintética');
reset role;
update pcm.sso_decisao_impacto_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_impacto_mediada_gate set habilitado=true where id;
update pcm.sso_avaliacao_impacto_revisao_gate set habilitado=true where id;
update pcm.sso_fila_visita_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_alterar_fila_visita('16500000-0000-0000-0000-000000000608','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000012','16500000-0000-0000-0000-000000000161','incluir',0,'Fixture');
select pcm.sso_iniciar_revisao_plano('16500000-0000-0000-0000-000000000609',4,'16500000-0000-0000-0000-000000000012','16500000-0000-0000-0000-000000000181');
select pcm.sso_transicionar_revisao_plano('16500000-0000-0000-0000-000000000610',5,'16500000-0000-0000-0000-000000000012','submeter');
reset role;
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
set local role authenticated;
do $$ declare f jsonb;r jsonb;begin
 f:=pcm.sso_comparar_rotina_impacto_v3('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000012',6,'16500000-0000-0000-0000-000000000181','16500000-0000-0000-0000-000000000161','visita');
 r:=pcm.sso_escolher_nova_visita('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-000000000611','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000012','16500000-0000-0000-0000-000000000181','16500000-0000-0000-0000-000000000161',6,0,'16500000-0000-0000-0000-000000000083',date_trunc('week',current_date)::date+18,'Fonte sintética','Escolha de teste',f);
end; $$;
reset role;
update pcm.aprovacao_revisao_gate set habilitado=true where id;
update pcm.sso_aprovacao_revisao_mediada_gate set habilitado=true where id;
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
update pcm.sso_protocolo_revisao_1731_gate set habilitado=true where id;
set local role authenticated;
select pcm.sso_aprovar_revisao_mediada('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000613',6,'16500000-0000-0000-0000-000000000012',current_date+1);
reset role;
-- Relógio civil sintético somente na transação revertida.
do $$ declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_data_civil_versao_geracao(uuid,uuid)'::regprocedure);a text:=$a$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date;$a$;b text:=$b$return (pg_catalog.transaction_timestamp() at time zone v_fuso)::date+1;$b$;begin if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'relogio_incompativel';end if;execute replace(d,a,b);end $$;
set local role authenticated;
select pcm.sso_aplicar_retiradas_fila('16500000-0000-0000-0000-000000000001','16500000-0000-0000-0000-000000000615','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000012',50,null,null);
reset role;
select id as nova_rotina from pcm.rotinas_manutencao where versao_id='16500000-0000-0000-0000-000000000181' limit 1 \gset
set local role authenticated;
select pcm.sso_editar_visita('16500000-0000-0000-0000-000000000616',1,'16500000-0000-0000-0000-000000000083',null,null,((date_trunc('week',current_date)::date+18)::text||' 08:00 America/Sao_Paulo')::timestamptz,((date_trunc('week',current_date)::date+18)::text||' 10:00 America/Sao_Paulo')::timestamptz,'America/Sao_Paulo',null,31);
select set_config('fixture.nova_rotina', :'nova_rotina', true);
do $$ begin
 begin
  perform pcm.sso_preparar_visita_canonica('16500000-0000-0000-0000-000000000617','16500000-0000-0000-0000-00000000000a','16500000-0000-0000-0000-000000000261','16500000-0000-0000-0000-000000000012','16500000-0000-0000-0000-000000000181',current_setting('fixture.nova_rotina')::uuid,'16500000-0000-0000-0000-000000000083',7,'Fonte sintética');
  raise exception 'candidata_alterada_aceita';
 exception when sqlstate 'P0020' then if sqlerrm <> 'visita_candidata_alterada' then raise;end if;end;
end $$;
reset role;
do $$ begin
 if (select estado from pcm.sso_fila_visita where preparada_id='16500000-0000-0000-0000-000000000161')<>'cancelado' then raise exception 'fila_divergente';end if;
 if exists(select 1 from pcm.sso_substituicoes_visita_materializadas where escolha_request_id='16500000-0000-0000-0000-000000000611') then raise exception 'substituicao_indevida';end if;
 if exists(select 1 from pcm.ocorrencias_visita_preparadas where id='16500000-0000-0000-0000-000000000261') then raise exception 'preparada_indevida';end if;
 if exists(select 1 from pcm.ordens_servico where client_id='16500000-0000-0000-0000-00000000000a') then raise exception 'os_indevida';end if;
end $$;
rollback;
