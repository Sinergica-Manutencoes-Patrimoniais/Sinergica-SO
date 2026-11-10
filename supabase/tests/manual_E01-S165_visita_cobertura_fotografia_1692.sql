-- Somente clone sintético até 1692; executar BEGIN/ROLLBACK. A fotografia é fixture,
-- inserida sem gatilhos para isolar o consumidor; não prova criação real da OS nem concorrência.
\ir manual_E01-S165_S166_ponte_visita_mediada.sql
reset role;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16610000-0000-0000-0000-000000000001','execucao.validar','16610000-0000-0000-0000-00000000000a');
update pcm.sso_origem_execucao_unificada_gate set habilitado=true where id;
set local session_replication_role=replica;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,status,prioridade,origem,created_by)
 values ('16610000-0000-0000-0000-000000000401','16610000-0000-0000-0000-00000000000a','OS-S1692-FIX','OS sintética','preventiva','solicitacao','media','manual','16610000-0000-0000-0000-000000000001');
insert into pcm.sso_origens_os_preventiva(os_id,cliente_id,plano_id,preparada_id,tipo,versao_id,rotina_id,snapshot)
select '16610000-0000-0000-0000-000000000401','16610000-0000-0000-0000-00000000000a',o.plano_id,o.id,'visita',o.versao_id,o.rotina_id,
 jsonb_set(v.snapshot,'{rotinas,0,questionario}',jsonb_build_object('id','16610000-0000-0000-0000-000000000141','perguntas',jsonb_build_array(jsonb_build_object('id','pergunta-fotografada'))))
from pcm.ocorrencias_visita_preparadas o join pcm.plano_versoes v on v.id=o.versao_id where o.plano_id='16610000-0000-0000-0000-000000000121' limit 1;
set local session_replication_role=origin;
set local request.jwt.claims='{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
do $$ declare r jsonb; n integer;begin
 r:=pcm.sso_previa_origem_visita_os('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000401');
 if r->>'snapshotHistoricoDisponivel'<>'true' or (r->>'quantidadePerguntas')::integer<>1 or r->'origem'->>'tipo'<>'visita' then raise exception 'previa_fotografada_divergente %',r;end if;
 select count(*) into n from pcm.sso_perguntas_origem_visita_os('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000401',0,20) where pergunta_id='pergunta-fotografada';
 if n<>1 then raise exception 'pergunta_fotografada_ausente';end if;
 begin perform pcm.sso_previa_origem_visita_os('16610000-0000-0000-0000-00000000000b','16610000-0000-0000-0000-000000000401');raise exception 'cliente_divergente_aceito';exception when insufficient_privilege then null;end;
end; $$;
