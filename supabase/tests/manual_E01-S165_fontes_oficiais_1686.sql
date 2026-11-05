-- Somente clone sintético, BEGIN/ROLLBACK; guarda 1045 e demais guardas não relacionadas
-- desligadas exclusivamente nesta transação para observar a validação de continuidade.
\ir manual_E01-S165_questionario_comparado_1660_visita.sql
reset role;
update pcm.questionarios set perguntas='[{"pergunta":"alterada"}]'::jsonb where id='16610000-0000-0000-0000-000000000141';
update pcm.sso_continuidade_revisao_gate set habilitado=true where id;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_inventario_pmoc_na_aprovacao;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_usos_pmoc_na_aprovacao;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_retiradas_na_aprovacao;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_validar_retiradas_antes_aprovacao;
savepoint visita_nativa;
insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122',current_date+30);
rollback to savepoint visita_nativa;
insert into pcm.tipos_tarefa(id,nome) values('16610000-0000-0000-0000-000000000886','Fixture 1686');
insert into pcm.planos_preventivos(id,cliente_id,sistema_id,questionario_id,tipo_tarefa_id,nome,primeira_data,intervalo_unidade,intervalo_n,estado,created_by) values('16610000-0000-0000-0000-000000000887','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000120','16610000-0000-0000-0000-000000000141','16610000-0000-0000-0000-000000000886','Legado não classificado',current_date,'meses',1,'ativo','16610000-0000-0000-0000-000000000001');
do $$ begin
 begin insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122',current_date+30);raise exception 'legado_indeterminado_aceito';
 exception when check_violation then if sqlerrm<>'impacto_parcial_pendente' then raise;end if;end;
end; $$;

update pcm.sso_ponte_legada_mediada_gate set habilitado=true where id;
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
update pcm.sso_relacao_plano_legado_gate set habilitado=true where id;
set local role authenticated;
do $$ declare f jsonb;a jsonb;b jsonb;begin
 f:=pcm.sso_prever_legado_nao_relacionado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000887',2);
 a:=pcm.sso_classificar_legado_nao_relacionado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000888','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000887',2,f->>'hash','Outro contrato','Conferido');
 b:=pcm.sso_classificar_legado_nao_relacionado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000888','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000887',2,f->>'hash','Outro contrato','Conferido');
 if a is distinct from b then raise exception 'replay_divergente';end if;
 begin perform pcm.sso_prever_legado_nao_relacionado('16610000-0000-0000-0000-000000000099','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000887',2);raise exception 'ator_divergente_aceito';exception when insufficient_privilege then null;end;
end; $$;
reset role;
savepoint negativo_atual;
insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122',current_date+30);
rollback to savepoint negativo_atual;
update pcm.planos_preventivos set nome='Legado alterado' where id='16610000-0000-0000-0000-000000000887';
do $$ begin begin insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122',current_date+30);raise exception 'negativo_obsoleto_aceito';exception when check_violation then if sqlerrm<>'impacto_parcial_pendente' then raise;end if;end;end; $$;
set local role authenticated;
select pcm.sso_declarar_relacao_legada_mediada('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000889','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000887',0,'declarar','Relação positiva em conferência');
reset role;
insert into pcm.ocorrencias_preventivas(plano_id,indice,vencimento,chave_externa) values('16610000-0000-0000-0000-000000000887',0,current_date,'fixture-1686');
do $$ begin begin insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122',current_date+30);raise exception 'positivo_sem_ponte_aceito';exception when check_violation then if sqlerrm<>'impacto_parcial_pendente' then raise;end if;end;end; $$;
