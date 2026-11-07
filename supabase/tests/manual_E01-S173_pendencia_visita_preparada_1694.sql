-- Somente clone descartável, BEGIN/ROLLBACK. Fotografia e retorno são sintéticos.
\ir E01-S173_retorno_aprovado_fixture.sql
update pcm.sso_pendencias_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
-- Ajustar os dados sintéticos para origem Sistema nativa com fotografia íntegra.
set local session_replication_role=replica;
update pcm.rotinas_manutencao set alvo_tipo='sistema',grupo_id=null,sistema_id='16891000-0000-4000-8000-000000000020' where id='16891000-0000-4000-8000-000000000009';
insert into pcm.ocorrencias_visita_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,visita_id,semana_origem,vencimento_original,fonte_dia_util_declarada,criado_por) values ('16891000-0000-4000-8000-000000000015','16891000-0000-4000-8000-000000000007','16891000-0000-4000-8000-000000000008','16891000-0000-4000-8000-000000000009','16891000-0000-4000-8000-000000000010','sistema','16891000-0000-4000-8000-000000000020','16891000-0000-4000-8000-000000000061','16891000-0000-4000-8000-000000000062','2026-01-01','2026-01-01','fixture','16891000-0000-4000-8000-000000000001');
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0}',((snapshot->'rotinas'->0)-'grupo_id')||jsonb_build_object('modo','visita','alvo_tipo','sistema','sistema_id','16891000-0000-4000-8000-000000000020')) where id='16891000-0000-4000-8000-000000000008';
update pcm.ordens_servico set ocorrencia_preventiva_id=null,sistema_id='16891000-0000-4000-8000-000000000020' where id='16891000-0000-4000-8000-000000000017';
insert into pcm.sso_origens_os_preventiva(os_id,cliente_id,plano_id,preparada_id,tipo,versao_id,rotina_id,snapshot)
select '16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000002',v.plano_id,'16891000-0000-4000-8000-000000000015','visita',v.id,'16891000-0000-4000-8000-000000000009',v.snapshot from pcm.plano_versoes v where v.id='16891000-0000-4000-8000-000000000008';
set local session_replication_role=origin;
do $$ begin
 begin perform pcm.sso_registrar_pendencia_retorno('16891000-0000-4000-8000-000000000091','16891000-0000-4000-8000-000000000019');raise exception 'barreira_visita_removida';
 exception when object_not_in_prerequisite_state then if sqlerrm<>'origem_consumidores_nao_integrados' then raise;end if;end;
 if exists(select 1 from pcm.sso_pendencias_tecnicas where resposta_id='16891000-0000-4000-8000-000000000019') then raise exception 'pendencia_indevida';end if;
end; $$;
