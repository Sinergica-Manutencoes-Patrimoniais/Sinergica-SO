-- Executar somente após fixture_only de manual_s169_origem_xlsx_staging_real.sql.
\set ON_ERROR_STOP on
begin;
set local test.uid='16891000-0000-4000-8000-000000000001';
set local role authenticated;
select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000201','16900000-0000-4000-8000-000000000202','16891000-0000-4000-8000-000000000002','consulta','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
do $$begin
 begin perform pcm.sso_consultar_origem_xlsx('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000202'); raise exception 'gate fechado permitiu consulta'; exception when sqlstate '55000' then if sqlerrm <> 'leitura_origem_xlsx_bloqueada' then raise; end if; end;
end$$;
reset role;
update pcm.sso_origem_xlsx_leitura_gate set habilitado=true where id;
set local role authenticated;
do $$declare v jsonb; begin
 v:=pcm.sso_consultar_origem_xlsx('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000202');
 if v->>'base64'<>'YWJj' or v->>'sha256'<>'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' or v->>'loteId'<>'16900000-0000-4000-8000-000000000202' then raise exception 'consulta divergente'; end if;
 begin perform pcm.sso_consultar_origem_xlsx('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000999'); raise exception 'lote inexistente aceito'; exception when insufficient_privilege then if sqlerrm <> 'lote_sem_acesso' then raise; end if; end;
 begin perform pcm.sso_consultar_origem_xlsx('16891000-0000-4000-8000-000000000003','16900000-0000-4000-8000-000000000202'); raise exception 'Cliente divergente aceito'; exception when insufficient_privilege then if sqlerrm <> 'lote_sem_acesso' then raise; end if; end;
 begin perform count(*) from pcm.sso_origens_xlsx_cronograma; raise exception 'leitura direta aceita'; exception when insufficient_privilege then null; end;
end$$;
reset role;
do $$begin if (select count(*) from audit.events where action='cronograma.origem_xlsx_consultada' and entity_id='16900000-0000-4000-8000-000000000202' and payload=jsonb_build_object('clienteId','16891000-0000-4000-8000-000000000002','tamanho',3))<>1 then raise exception 'auditoria inválida'; end if; end$$;
update config.permissao_teste set habilitada=false;
set local role authenticated;
do $$begin begin perform pcm.sso_consultar_origem_xlsx('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000202'); raise exception 'permissão revogada aceita'; exception when insufficient_privilege then if sqlerrm <> 'lote_sem_acesso' then raise; end if; end; end$$;
reset role;
update config.permissao_teste set habilitada=true;
update pcm.sso_cronograma_staging_gate set habilitado=false where id;
set local role authenticated;
do $$begin begin perform pcm.sso_consultar_origem_xlsx('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000202'); raise exception 'gate de cronograma fechado aceito'; exception when sqlstate '55000' then if sqlerrm <> 'cronograma_staging_bloqueado' then raise; end if; end; end$$;
reset role;
update pcm.sso_cronograma_staging_gate set habilitado=true where id;
create function audit.falhar_consulta_teste() returns trigger language plpgsql as $$begin if new.action='cronograma.origem_xlsx_consultada' then raise exception 'auditoria_indisponivel'; end if; return new; end$$;
create trigger falhar_consulta_teste before insert on audit.events for each row execute function audit.falhar_consulta_teste();
set local role authenticated;
do $$begin begin perform pcm.sso_consultar_origem_xlsx('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000202'); raise exception 'consulta sem auditoria aceita'; exception when raise_exception then if sqlerrm <> 'auditoria_indisponivel' then raise; end if; end; end$$;
reset role;
drop trigger falhar_consulta_teste on audit.events;
update pcm.sso_origens_xlsx_cronograma set bytes=decode('ZGVm','base64') where lote_id='16900000-0000-4000-8000-000000000202';
set local role authenticated;
do $$begin begin perform pcm.sso_consultar_origem_xlsx('16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000202'); raise exception 'origem corrompida aceita'; exception when sqlstate '55000' then if sqlerrm <> 'origem_xlsx_corrompida' then raise; end if; end; end$$;
rollback;
