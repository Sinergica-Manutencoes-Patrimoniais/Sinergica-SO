\set ON_ERROR_STOP on
do $$begin if current_database() <> 'sso_s169_descartavel' then raise exception 'banco nao descartavel'; end if; end$$;
do $$begin
 if exists(select 1 from pcm.sso_levantamentos where id='16900000-0000-4000-8000-000000000242') then raise exception 'lote foi criado'; end if;
 if exists(select 1 from pcm.sso_origens_xlsx_cronograma where lote_id='16900000-0000-4000-8000-000000000242') then raise exception 'origem foi criada'; end if;
 if exists(select 1 from pcm.sso_levantamento_comandos where request_id='16900000-0000-4000-8000-000000000241') then raise exception 'comando foi criado'; end if;
 if exists(select 1 from audit.events where entity_id='16900000-0000-4000-8000-000000000242') then raise exception 'auditoria foi criada'; end if;
end$$;
