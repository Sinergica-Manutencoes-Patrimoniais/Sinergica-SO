\set ON_ERROR_STOP on
do $$begin if current_database() <> 'sso_s169_descartavel' then raise exception 'banco nao descartavel'; end if; end$$;
do $$ begin
 if (select count(*) from pcm.sso_levantamentos where id='16900000-0000-4000-8000-000000000212') <> 1 then raise exception 'lotes duplicados ou ausentes'; end if;
 if (select count(*) from pcm.sso_origens_xlsx_cronograma where lote_id='16900000-0000-4000-8000-000000000212') <> 1 then raise exception 'origens duplicadas ou ausentes'; end if;
 if (select count(*) from pcm.sso_levantamento_comandos where request_id='16900000-0000-4000-8000-000000000211') <> 1 then raise exception 'comandos duplicados ou ausentes'; end if;
 if (select count(*) from audit.events where entity_id='16900000-0000-4000-8000-000000000212' and action='cronograma.origem_xlsx_recebida') <> 1 then raise exception 'auditoria de origem duplicada ou ausente'; end if;
end $$;
