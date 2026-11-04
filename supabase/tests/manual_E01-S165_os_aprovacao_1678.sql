-- Somente clone e transação revertida. Guardas não relacionadas são desligadas aqui para isolar a 1678.
\ir manual_E01-S165_os_comparacao_1662.sql
set local role authenticated;
do $$ declare f jsonb;p uuid;begin
 select (foto->>'preparadaId')::uuid into p from os_comparacao_1662;
 f:=pcm.sso_comparar_rotina_impacto_v3('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'16630000-1111-4000-8000-000000000022',p,'calendario');
 perform pcm.sso_decidir_impacto_comparado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000207','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'manter_sem_alterar','conferido','calendario',f);
end; $$;
reset role;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_bloquear_aprovacao_impacto_indeterminado;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_continuidades_na_aprovacao;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_inventario_pmoc_na_aprovacao;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_retiradas_na_aprovacao;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_usos_pmoc_na_aprovacao;
alter table pcm.aprovacao_revisao_tokens disable trigger sso_validar_retiradas_antes_aprovacao;

savepoint token_atual;
insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021',current_date+30);
rollback to savepoint token_atual;
set local session_replication_role=replica;
update pcm.ordens_servico set status='finalizado',updated_at=now()+interval '2 seconds' where id='16630000-1111-4000-8000-000000000201';
set local session_replication_role=origin;
do $$ begin
 begin insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021',current_date+30);raise exception 'aprovacao_os_obsoleta_aceita';
 exception when check_violation then if sqlerrm<>'comparacao_os_obsoleta' then raise;end if;end;
end; $$;
