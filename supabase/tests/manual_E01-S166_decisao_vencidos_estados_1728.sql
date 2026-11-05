-- Clone descartável, BEGIN/ROLLBACK; nenhum envio externo nem modificação de 1045.
\ir manual_E01-S166_decisao_ativacao_1728.sql
reset role;
-- Garante dois intervalos históricos não sobrepostos apenas no setup sintético.
set local session_replication_role=replica;
update pcm.plano_versoes set vigencia_inicio=current_setting('sso.fixture.sp')::date-6, vigencia_fim=current_setting('sso.fixture.sp')::date-3, snapshot=jsonb_set(snapshot,'{rotinas,0,data_base}',to_jsonb((current_setting('sso.fixture.sp')::date-5)::text)) where id='16660000-0000-4000-8000-000000000021';
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,snapshot,created_by) select '17280000-0000-4000-8000-000000000022',plano_id,2,'aprovado',current_setting('sso.fixture.sp')::date-2,snapshot,created_by from pcm.plano_versoes where id='16660000-0000-4000-8000-000000000021';
update pcm.planos_manutencao set estado='encerrado' where id='16660000-0000-4000-8000-000000000011';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;begin
 -- Retry existente permanece recuperavel ainda que o Plano esteja encerrado.
 a:=pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17280000-0000-4000-8000-000000000046','17280000-0000-4000-8000-000000000047','16660000-0000-4000-8000-000000000011',1,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',0,current_setting('sso.fixture.sp')::date-1,'avaliar','fixture');
 if a->>'efeitoOperacional'<>'false' then raise exception 'replay_divergente';end if;
 begin perform pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17280000-0000-4000-8000-000000000060','17280000-0000-4000-8000-000000000061','16660000-0000-4000-8000-000000000011',1,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',0,current_setting('sso.fixture.sp')::date-5,'avaliar','fixture');raise exception 'encerrado_aceitou_nova_escrita';exception when check_violation then if sqlerrm<>'plano_encerrado_somente_consulta' then raise;end if;end;
end $$;
reset role;
set local session_replication_role=replica;
update pcm.planos_manutencao set estado='suspenso' where id='16660000-0000-4000-8000-000000000011';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare a jsonb;begin
 -- Suspenso nao ganha proibicao nova; versao anterior vale somente no proprio intervalo.
 a:=pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17280000-0000-4000-8000-000000000062','17280000-0000-4000-8000-000000000063','16660000-0000-4000-8000-000000000011',1,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',0,current_setting('sso.fixture.sp')::date-5,'avaliar','fixture');
 if a->>'efeitoOperacional'<>'false' then raise exception 'historico_divergente';end if;
 begin perform pcm.sso_decisao_vencimento_mediada('16660000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','17280000-0000-4000-8000-000000000064','17280000-0000-4000-8000-000000000065','16660000-0000-4000-8000-000000000011',1,'16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',3,current_setting('sso.fixture.sp')::date-2,'avaliar','fixture');raise exception 'ciclo_fora_vigencia_aceito';exception when check_violation then if sqlerrm<>'candidato_nao_comprovado' then raise;end if;end;
end $$;
reset role;
