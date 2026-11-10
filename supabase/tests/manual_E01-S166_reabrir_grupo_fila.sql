-- Após migrations até 1681, executar em clone sintético com BEGIN/ROLLBACK.
\ir manual_E01-S166_grupo_fila_afirmacao.sql
set local role authenticated;
do $$ declare v jsonb;a jsonb;b jsonb; begin
 v:=pcm.sso_prever_fila_grupo_v2('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario');
 if v->>'filaEstado'<>'aguardando' or v->>'declaracaoAtual'<>'false' or v->>'podeReabrir'<>'true' then raise exception 'previa_reabertura_divergente: %',v;end if;
 a:=pcm.sso_reabrir_fila_grupo('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000030','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario',2,'revisar fonte alterada');
 b:=pcm.sso_reabrir_fila_grupo('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000030','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario',2,'revisar fonte alterada');
 if a is distinct from b or a->>'estado'<>'verificacao' or (a->>'revision')::integer<>3 or a->>'osAlteradas'<>'false' or a->>'ocorrenciaCriada'<>'false' or a->>'tarefaAuvoCriada'<>'false' then raise exception 'reabertura_divergente: %',a;end if;
 begin perform pcm.sso_reabrir_fila_grupo('17390000-0000-4000-8000-000000000001','17390000-0000-4000-8000-000000000031','17390000-0000-4000-8000-000000000002','17390000-0000-4000-8000-000000000007','17390000-0000-4000-8000-000000000011','calendario',2,'outra tentativa');raise exception 'revisao_antiga_aceita';exception when sqlstate 'P0012' then if sqlerrm<>'fila_ou_revisao_indisponivel' then raise;end if;end;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.ocorrencias_rotina_preparadas where id='17390000-0000-4000-8000-000000000011')<>1 then raise exception 'ocorrencia_duplicada';end if;
 if (select status from pcm.ordens_servico where id='17390000-0000-4000-8000-000000000014')<>'solicitacao' then raise exception 'os_alterada';end if;
 if has_function_privilege('anon','pcm.sso_reabrir_fila_grupo(uuid,uuid,uuid,uuid,uuid,text,integer,text)','execute') then raise exception 'acl_anon_indevida';end if;
end; $$;
