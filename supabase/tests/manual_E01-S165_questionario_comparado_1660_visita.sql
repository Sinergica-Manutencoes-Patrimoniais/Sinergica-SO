-- Rodar em clone descartável após migrations até 1660; a transação externa faz rollback.
\ir manual_E01-S165_decisao_visita_comparada_1657.sql
reset role;
-- Fixture: reconstrói no histórico somente para exercitar referência igual e conteúdo mutável.
set local session_replication_role=replica;
update pcm.plano_versoes set snapshot=jsonb_set(jsonb_set(snapshot,'{rotinas,0,questionario_id}',to_jsonb('16610000-0000-0000-0000-000000000141'::text)),'{rotinas,0,questionario}',(select to_jsonb(q) from pcm.questionarios q where id='16610000-0000-0000-0000-000000000141')) where id='16610000-0000-0000-0000-000000000122';
update pcm.rotinas_manutencao set questionario_id='16610000-0000-0000-0000-000000000141' where versao_id='16610000-0000-0000-0000-000000000181';
set local session_replication_role=origin;
set local role authenticated;
create temporary table comparacao_1660 as select pcm.sso_comparar_rotina_impacto_v2('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',2,'16610000-0000-0000-0000-000000000181',(select (foto->>'preparadaId')::uuid from comparacao_1657),'visita') foto;
do $$ begin if (select foto->'questionarioComparacao'->>'estado' from comparacao_1660)<>'conteudo_integral_igual' then raise exception 'questionario_deveria_ser_igual';end if;end; $$;
reset role;
update pcm.questionarios set perguntas='[{"pergunta":"alterada"}]'::jsonb where id='16610000-0000-0000-0000-000000000141';
set local role authenticated;
do $$ declare f jsonb;p_id uuid;begin select foto,(foto->>'preparadaId')::uuid into f,p_id from comparacao_1660;
 begin perform pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000451','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p_id,2,2,'manter_sem_alterar','conferido','visita',f);raise exception 'mudanca_questionario_aceita';exception when serialization_failure then if sqlerrm<>'comparacao_obsoleta' then raise;end if;end;
end; $$;
create temporary table comparacao_atual_1660 as select pcm.sso_comparar_rotina_impacto_v2('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',2,'16610000-0000-0000-0000-000000000181',(select (foto->>'preparadaId')::uuid from comparacao_1657),'visita') foto;
do $$ declare f jsonb;p_id uuid;a jsonb;b jsonb;begin select foto,(foto->>'preparadaId')::uuid into f,p_id from comparacao_atual_1660;
 if f->'questionarioComparacao'->>'estado'<>'conteudo_integral_diferente' then raise exception 'diferenca_nao_detectada';end if;
 a:=pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000452','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p_id,2,2,'manter_sem_alterar','conferido','visita',f);
 b:=pcm.sso_decidir_impacto_comparado('16610000-0000-0000-0000-000000000001','16610000-0000-0000-0000-000000000452','16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000181',p_id,2,2,'manter_sem_alterar','conferido','visita',f);
 if a is distinct from b then raise exception 'replay_divergente';end if;
end; $$;
reset role;
-- Em clone, verifica que a fotografia ainda atual não é bloqueada pelo novo trigger.
alter table pcm.aprovacao_revisao_tokens disable trigger sso_bloquear_aprovacao_impacto_indeterminado;
savepoint token_com_foto_atual;
insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values (txid_current(),'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122',current_date+30);
rollback to savepoint token_com_foto_atual;
update pcm.questionarios set perguntas='[{"pergunta":"alterada de novo"}]'::jsonb where id='16610000-0000-0000-0000-000000000141';
-- A guarda 1045 foi desligada somente nesta transação sintética para observar o trigger novo.
do $$ begin
 begin insert into pcm.aprovacao_revisao_tokens(txid,plano_id,versao_anterior_id,vigencia_inicio) values (txid_current(),'16610000-0000-0000-0000-000000000121','16610000-0000-0000-0000-000000000122',current_date+30);raise exception 'aprovacao_questionario_obsoleto_aceita';exception when check_violation then if sqlerrm<>'comparacao_questionario_obsoleta' then raise;end if;end;
end; $$;
