-- Somente clone descartável, BEGIN/ROLLBACK. Fotografia e retorno são sintéticos.
\ir E01-S173_retorno_aprovado_fixture.sql
update pcm.sso_pendencias_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
-- Ajustar os dados sintéticos para origem Sistema nativa com fotografia íntegra.
set local session_replication_role=replica;
update pcm.rotinas_manutencao set alvo_tipo='sistema',grupo_id=null,sistema_id='16891000-0000-4000-8000-000000000020' where id='16891000-0000-4000-8000-000000000009';
update pcm.ocorrencias_rotina_preparadas set alvo_tipo='sistema',alvo_id='16891000-0000-4000-8000-000000000020' where id='16891000-0000-4000-8000-000000000015';
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0}',((snapshot->'rotinas'->0)-'grupo_id')||jsonb_build_object('modo','calendario','alvo_tipo','sistema','sistema_id','16891000-0000-4000-8000-000000000020')) where id='16891000-0000-4000-8000-000000000008';
update pcm.ordens_servico set ocorrencia_preventiva_id=null,sistema_id='16891000-0000-4000-8000-000000000020' where id='16891000-0000-4000-8000-000000000017';
insert into pcm.sso_origens_os_preventiva(os_id,cliente_id,plano_id,preparada_id,tipo,versao_id,rotina_id,snapshot)
select '16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000002',v.plano_id,'16891000-0000-4000-8000-000000000015','calendario',v.id,'16891000-0000-4000-8000-000000000009',v.snapshot from pcm.plano_versoes v where v.id='16891000-0000-4000-8000-000000000008';
set local session_replication_role=origin;
do $$ declare r jsonb;p pcm.sso_pendencias_tecnicas%rowtype;begin
 r:=pcm.sso_registrar_pendencia_retorno('16891000-0000-4000-8000-000000000091','16891000-0000-4000-8000-000000000019');
 select * into p from pcm.sso_pendencias_tecnicas where id=(r->>'pendenciaId')::uuid;
 if p.ocorrencia_calendario_preparada_id is distinct from '16891000-0000-4000-8000-000000000015'::uuid or p.ocorrencia_id is not null or p.ocorrencia_grupo_id is not null or p.ocorrencia_visita_preparada_id is not null then raise exception 'origem_nativa_divergente';end if;
 if r is distinct from pcm.sso_registrar_pendencia_retorno('16891000-0000-4000-8000-000000000091','16891000-0000-4000-8000-000000000019') then raise exception 'replay_divergente';end if;
end; $$;
