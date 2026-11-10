-- Somente banco descartável montado por manual_s169_origem_xlsx_staging_real.sql com fixture_only.
\set ON_ERROR_STOP on
begin;
set local test.uid='16891000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 begin
  perform pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000301','16900000-0000-4000-8000-000000000302','16891000-0000-4000-8000-000000000002','adulterado','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  raise exception 'matriz fornecida pelo cliente foi aceita';
 exception when insufficient_privilege then null; end;
 perform pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000303','16900000-0000-4000-8000-000000000304','16891000-0000-4000-8000-000000000002','csv','[[1],[2],[3],[4],[5]]');
end$$;
reset role;
do $$begin
 if exists(select 1 from pcm.sso_levantamentos where id='16900000-0000-4000-8000-000000000302') then raise exception 'lote XLSX inesperado'; end if;
 if not exists(select 1 from pcm.sso_levantamentos where id='16900000-0000-4000-8000-000000000304') then raise exception 'CSV deixou de funcionar'; end if;
 if has_function_privilege('anon','pcm.sso_receber_xlsx_cronograma(uuid,uuid,uuid,text,jsonb,text,text)','execute') or has_function_privilege('service_role','pcm.sso_receber_xlsx_cronograma(uuid,uuid,uuid,text,jsonb,text,text)','execute') then raise exception 'papel indevido mantém execução'; end if;
end$$;
rollback;
