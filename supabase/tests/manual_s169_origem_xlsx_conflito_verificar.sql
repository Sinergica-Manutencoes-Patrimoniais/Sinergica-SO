\set ON_ERROR_STOP on
do $$begin if current_database() <> 'sso_s169_descartavel' then raise exception 'banco nao descartavel'; end if; end$$;
do $$declare l uuid := '16900000-0000-4000-8000-000000000222'; begin
 if (select count(*) from pcm.sso_levantamentos where id=l) <> 1 then raise exception 'lote ausente ou duplicado'; end if;
 if (select count(*) from pcm.sso_origens_xlsx_cronograma where lote_id=l and bytes=decode('YWJj','base64')) <> 1 then raise exception 'origem alterada ou ausente'; end if;
 if (select count(*) from pcm.sso_levantamento_comandos where request_id='16900000-0000-4000-8000-000000000221') <> 1 then raise exception 'comando ausente ou duplicado'; end if;
 if (select count(*) from audit.events where entity_id=l and action='cronograma.origem_xlsx_recebida') <> 1 then raise exception 'auditoria divergente'; end if;
end$$;
