-- Clone sintético com migrations até 1698, executar BEGIN/ROLLBACK. Não aciona Auvo.
-- Inclui listagem real e classificação real; decisão e finalização ainda não estão neste roteiro.
\ir manual_E01-S168_listar_fotografia_1698.sql
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
