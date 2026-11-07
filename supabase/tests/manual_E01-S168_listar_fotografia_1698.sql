-- Clone sintético, migrations até 1698, executar BEGIN/ROLLBACK; nenhum Auvo real.
\ir E01-S168_origem_calendario_valida_fixture.sql
update pcm.origem_campo_inbox_gate set habilitado=true where id;
update pcm.validacao_os_gate set habilitado=true where id;
update pcm.sso_classificacao_retorno_mediada_gate set leitura=true where id;
set local session_replication_role=replica;
insert into pcm.sso_origens_os_preventiva(os_id,cliente_id,plano_id,preparada_id,tipo,versao_id,rotina_id,snapshot)
 select '16891000-0000-4000-8000-000000000017','16891000-0000-4000-8000-000000000002',v.plano_id,'16891000-0000-4000-8000-000000000015','calendario',v.id,'16891000-0000-4000-8000-000000000009',v.snapshot from pcm.plano_versoes v where v.id='16891000-0000-4000-8000-000000000008';
-- Torna a versão mutável divergente; a listagem deve usar a foto, não ela.
update pcm.plano_versoes set snapshot=jsonb_set(snapshot,'{rotinas,0,questionario,perguntas}','[]'::jsonb) where id='16891000-0000-4000-8000-000000000008';
set local session_replication_role=origin;
set local request.jwt.claims='{"sub":"16891000-0000-4000-8000-000000000001","role":"authenticated","user_role":"superadmin"}';
set local role authenticated;
do $$ declare n integer;p jsonb;begin
 select count(*),min(perguntas::text)::jsonb into n,p from pcm.sso_listar_retornos_classificaveis_mediada('16891000-0000-4000-8000-000000000002',null,20);
 if n<>1 or jsonb_array_length(p)<>2 or p->0->>'id'<>'p1' then raise exception 'listagem_foto_calendario_divergente';end if;
 if (select count(*) from pcm.sso_listar_retornos_classificaveis_mediada('16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035',20))<>0 then raise exception 'paginacao_divergente';end if;
 begin perform * from pcm.sso_listar_retornos_classificaveis_mediada('16891000-0000-4000-8000-000000000099',null,20);raise exception 'outro_cliente_aceito';exception when insufficient_privilege then null;end;
end; $$;
reset role;
-- Converter exclusivamente a fixture para Visita sem ocorrência legada na OS.
set local session_replication_role=replica;
insert into pcm.ocorrencias_visita_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,visita_id,semana_origem,vencimento_original,fonte_dia_util_declarada,criado_por)
 values ('16891000-0000-4000-8000-000000000115','16891000-0000-4000-8000-000000000007','16891000-0000-4000-8000-000000000008','16891000-0000-4000-8000-000000000009','16891000-0000-4000-8000-000000000010','sistema','16891000-0000-4000-8000-000000000020','16891000-0000-4000-8000-000000000061','16891000-0000-4000-8000-000000000062','2026-01-01','2026-01-01','fixture','16891000-0000-4000-8000-000000000001');
update pcm.ordens_servico set ocorrencia_preventiva_id=null where id='16891000-0000-4000-8000-000000000017';
update pcm.sso_origens_os_preventiva set tipo='visita',preparada_id='16891000-0000-4000-8000-000000000115',snapshot=jsonb_set(snapshot,'{rotinas,0,modo}','"visita"'::jsonb) where os_id='16891000-0000-4000-8000-000000000017';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare n integer;p jsonb;begin
 select count(*),min(perguntas::text)::jsonb into n,p from pcm.sso_listar_retornos_classificaveis_mediada('16891000-0000-4000-8000-000000000002',null,20);
 if n<>1 or jsonb_array_length(p)<>2 then raise exception 'listagem_foto_visita_divergente';end if;
end; $$;
reset role;
