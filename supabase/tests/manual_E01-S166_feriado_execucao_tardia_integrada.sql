-- Clone sintético; execução de retorno/finalização real, dados e foto sintéticos; ROLLBACK.
begin;
-- Clone sintético, migrations até 1698, executar BEGIN/ROLLBACK; nenhum Auvo real.
\ir E01-S168_origem_calendario_valida_fixture.sql
-- Dados sintéticos: vencimento em feriado e retorno uma semana depois.
set local session_replication_role=replica;
update pcm.origem_campo_inbox set ocorrido_em='2026-01-08 12:00+00' where id='16891000-0000-4000-8000-000000000035';
update pcm.plano_versoes set vigencia_inicio='2026-01-01',snapshot=jsonb_set(snapshot,'{rotinas,0}',(snapshot->'rotinas'->0)||'{"data_base":"2026-01-01","intervalo_n":1,"intervalo_unidade":"meses","tolerancia_antes":0,"tolerancia_depois":0}'::jsonb) where id='16891000-0000-4000-8000-000000000008';
set local session_replication_role=origin;
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values('16891000-0000-4000-8000-000000000001','plano.gerir','16891000-0000-4000-8000-000000000002');
insert into pcm.feriados_declarados(id,cliente_id,data,fonte,motivo,criado_por) values('17340000-0000-4000-8000-000000000020','16891000-0000-4000-8000-000000000002','2026-01-01','fixture','feriado','16891000-0000-4000-8000-000000000001');
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


-- PCM trata o vencimento em feriado antes da execução tardia.
update pcm.sso_decisao_feriado_calendario_gate set habilitado=true where id;
update pcm.feriado_declarado_gate set habilitado=true where id;
set local role authenticated;
do $$ declare d jsonb;begin
 d:=pcm.sso_decidir_feriado_calendario('17340000-0000-4000-8000-000000000021','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000015','17340000-0000-4000-8000-000000000020',0,'Manter para PCM');
 if d->>'decisao' is distinct from 'manter_para_pcm' then raise exception 'decisao_feriado_divergente';end if;
end $$;
reset role;
update pcm.sso_classificacao_retorno_mediada_gate set escrita=true where id;
set local role authenticated;
do $$ declare a jsonb;b jsonb;begin
 a:=pcm.sso_classificar_retorno_campo_mediada('16891000-0000-4000-8000-000000000037','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000038','[{"perguntaId":"p1","resultado":"ok"},{"perguntaId":"p2","resultado":"ok"}]'::jsonb);
 b:=pcm.sso_classificar_retorno_campo_mediada('16891000-0000-4000-8000-000000000037','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000038','[{"perguntaId":"p1","resultado":"ok"},{"perguntaId":"p2","resultado":"ok"}]'::jsonb);
 if a is distinct from b or a->>'retornoId'<>'16891000-0000-4000-8000-000000000038' then raise exception 'classificacao_foto_divergente';end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.respostas_os_preparadas where retorno_id='16891000-0000-4000-8000-000000000038')<>2 then raise exception 'respostas_divergentes';end if;
end; $$;


update pcm.sso_conferencia_cobertura_retorno_gate set habilitado=true where id;
update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;
update pcm.sso_validacao_resposta_gate set habilitado=true where id;
update pcm.sso_revisao_validacao_os_gate set habilitado=true where id;
update pcm.sso_condicao_retorno_gate set habilitado=true where id;
update pcm.sso_condicao_evidencia_gate set habilitado=true where id;
update pcm.sso_atestacao_pcm_gate set habilitado=true where id;
update pcm.sso_pendencias_gate set habilitado=true where id;
update pcm.sso_finalizar_os_validada_gate set habilitado=true where id;
update pcm.sso_mediacao_finalizacao_os_gate set habilitado=true where id;
update pcm.sso_aprovacao_finalizacao_atomica_gate set habilitado=true where id;
set local role authenticated;
do $$ declare c jsonb;a jsonb;b jsonb;begin
 c:=pcm.sso_conferir_cobertura_mediada('16891000-0000-4000-8000-000000000040','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000038',null,0,'Conferência sintética');
 if c->>'coberturaEstrutural'<>'true' then raise exception 'conferencia_divergente';end if;
 a:=pcm.sso_aprovar_finalizar_os_atomico('16891000-0000-4000-8000-000000000046','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000038',(c->>'conferenciaId')::uuid,0,0,'Atestação sintética','16891000-0000-4000-8000-000000000017','em_execucao','2026-10-01T10:00:00Z');
 b:=pcm.sso_aprovar_finalizar_os_atomico('16891000-0000-4000-8000-000000000046','16891000-0000-4000-8000-000000000002','16891000-0000-4000-8000-000000000038',(c->>'conferenciaId')::uuid,0,0,'Atestação sintética','16891000-0000-4000-8000-000000000017','em_execucao','2026-10-01T10:00:00Z');
 if a is distinct from b or a->>'osEncerrada'<>'true' or a->>'chamadoAlterado'<>'false' then raise exception 'finalizacao_divergente';end if;
end; $$;
reset role;
do $$ begin if (select status from pcm.ordens_servico where id='16891000-0000-4000-8000-000000000017')<>'finalizado' then raise exception 'os_nao_finalizada';end if;end; $$;

do $$ declare d date;begin
 if (select vencimento_original from pcm.ocorrencias_rotina_preparadas where id='16891000-0000-4000-8000-000000000015')<>'2026-01-01'::date then raise exception 'vencimento_original_alterado';end if;
 select vencimento into strict d from pcm.sso_prever_ciclos_rotina('16891000-0000-4000-8000-000000000007','16891000-0000-4000-8000-000000000008','16891000-0000-4000-8000-000000000009','2026-02-01','2026-02-01') where ciclo=1;
 if d<>'2026-02-01'::date then raise exception 'ancora_deslocada';end if;
end $$;
rollback;
