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


insert into pcm.avaliacoes_preventivas(ocorrencia_id,chave_origem) select ocorrencia_legada_id,'fixture-1743' from pcm.ocorrencias_rotina_vinculos where ocorrencia_preparada_id=(select (foto->>'preparadaId')::uuid from os_comparacao_1662);
do $$ begin
 begin insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values(txid_current(),'16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000021',current_date+30);raise exception 'aprovacao_avaliacao_obsoleta_aceita';
 exception when check_violation then if sqlerrm<>'comparacao_avaliacao_obsoleta' then raise;end if;end;
end $$;
