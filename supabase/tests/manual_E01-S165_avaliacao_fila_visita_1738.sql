-- Clone descartável, com migrations até 1738; não envia tarefas.
begin;
\ir manual_E01-S165_S166_ponte_visita_mediada.sql
do $$ declare c uuid;l uuid;v text;begin
 select ciclo_id into strict c from pcm.sso_ciclo_visita_versoes where preparada_id='16610000-0000-0000-0000-000000000161';
 select ocorrencia_legada_id into strict l from pcm.sso_vinculos_visita_legado where ocorrencia_visita_id='16610000-0000-0000-0000-000000000161';
 v:=pcm.sso_estado_fila_visita('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',c);
 if v is distinct from 'candidata' then raise exception 'estado_sem_avaliacao_divergente: %',v;end if;
 insert into pcm.avaliacoes_preventivas(ocorrencia_id,chave_origem) values(l,'fixture-avaliacao-visita-1738');
 v:=pcm.sso_estado_fila_visita('16610000-0000-0000-0000-00000000000a','16610000-0000-0000-0000-000000000121',c);
 if v is distinct from 'indeterminado' then raise exception 'avaliacao_ignorada: %',v;end if;
end $$;
rollback;
