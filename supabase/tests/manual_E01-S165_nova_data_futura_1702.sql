-- Clone descartável com migrations até 1702. BEGIN/ROLLBACK; 1045 intacta.
\ir manual_E01-S165_impacto_calendario_nativo_1704.sql
-- Deslocamento sintético somente no clone: data original futura para vigência válida.
set local session_replication_role=replica;
update pcm.ocorrencias_rotina_preparadas set vencimento_original=current_date+10 where plano_id='16630000-1111-4000-8000-000000000011';
update pcm.rotinas_manutencao set data_base=current_date+10 where versao_id='16630000-1111-4000-8000-000000000021';
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,data_base}',to_jsonb((current_date+10)::text)) where id='16630000-1111-4000-8000-000000000021';
update pcm.sso_series_ciclo_calendario set ancora=current_date+10 where plano_id='16630000-1111-4000-8000-000000000011';
update pcm.sso_ciclos_calendario_canonicos set vencimento_original=current_date+10 where serie_id in (select id from pcm.sso_series_ciclo_calendario where plano_id='16630000-1111-4000-8000-000000000011');
set local session_replication_role=origin;
reset role;
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
insert into pcm.questionarios(id,auvo_id,nome,ativo) values ('16630000-1111-4000-8000-000000000706',166300706,'Questionário sintético',true);
update pcm.rotinas_manutencao set data_base=current_date+11,instrucao='Inspeção de teste',questionario_id='16630000-1111-4000-8000-000000000706' where versao_id='16630000-1111-4000-8000-000000000022';
set local role authenticated;
select pcm.sso_transicionar_revisao_plano('16630000-1111-4000-8000-000000000202',2,'16630000-1111-4000-8000-000000000011','submeter');
do $$ declare p uuid;f jsonb;a jsonb;b jsonb;begin
 select preparada_id into p from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,null,20) limit 1;
 f:=pcm.sso_comparar_rotina_impacto_v3('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',3,'16630000-1111-4000-8000-000000000022',p,'calendario');
 if not exists(select 1 from pcm.sso_prever_novas_datas_calendario('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,3,current_date,current_date+30,f) where indice=0 and vencimento=current_date+11) then raise exception 'previa_nao_contem_candidato';end if;
 begin
  perform pcm.sso_escolher_nova_data_calendario('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000702','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,3,1,0,current_date+12,'Conferido',f);
  raise exception 'data_incompativel_aceita';exception when check_violation then if sqlerrm<>'nova_data_invalida' then raise;end if;end;
 a:=pcm.sso_escolher_nova_data_calendario('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000702','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,3,1,0,current_date+11,'Conferido',f);
 b:=pcm.sso_escolher_nova_data_calendario('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000702','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,3,1,0,current_date+11,'Conferido',f);
 if a is distinct from b or a->>'novaDataEscolhida' is distinct from (current_date+11)::text or a->>'substituicaoAplicada'<>'false' then raise exception 'escolha_ou_replay_divergente: %',a;end if;
end; $$;
reset role;
do $$ declare p uuid;begin
 select id into p from pcm.ocorrencias_rotina_preparadas where plano_id='16630000-1111-4000-8000-000000000011';
 if not pcm.sso_escolha_nova_data_calendario_atual('16630000-1111-4000-8000-000000000702','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',3) then raise exception 'escolha_nao_reconhecida';end if;
 if exists(select 1 from pcm.sso_substituicoes_calendario_aprovadas where preparada_id=p) or (select vencimento_original from pcm.ocorrencias_rotina_preparadas where id=p) is distinct from current_date+10 then raise exception 'efeito_antecipado';end if;
end; $$;
update config.sso_concessoes set ativa=false where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
set local role authenticated;
do $$ begin
 begin perform * from pcm.sso_prever_novas_datas_calendario('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022','16630000-1111-4000-8000-000000000061',3,current_date,current_date+30,'{}'::jsonb);raise exception 'permissao_revogada_aceita';exception when insufficient_privilege then null;end;
end; $$;
reset role;
