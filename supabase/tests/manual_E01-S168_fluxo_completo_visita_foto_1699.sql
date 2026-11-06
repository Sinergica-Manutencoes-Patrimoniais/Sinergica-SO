-- Clone sintético com migrations até 1699, BEGIN/ROLLBACK. Nenhum Auvo externo.
-- Faz listagem e classificação real; segue com conferência, aprovação e finalização reais.
\ir manual_E01-S168_fluxo_visita_foto_1698.sql
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
