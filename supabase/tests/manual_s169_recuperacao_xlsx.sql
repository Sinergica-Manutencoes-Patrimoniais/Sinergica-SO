-- Somente fixture descartável: identifica origem sem retornar bytes ou request.
\set ON_ERROR_STOP on
begin;
set local test.uid='16891000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ declare c uuid := '16891000-0000-4000-8000-000000000002';
  p uuid := '16900000-0000-4000-8000-000000000701'; l uuid := '16900000-0000-4000-8000-000000000702';
  h text := 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'; v jsonb;
begin
 v := pcm.sso_recuperar_origem_xlsx(c,'origem-700');
 if v <> '{"estado":"ausente"}'::jsonb then raise exception 'origem inexistente incorreta'; end if;
 perform pcm.sso_receber_xlsx_cronograma(p,l,c,'origem-700','[[1],[2],[3],[4],[5]]','YWJj',h);
 v := pcm.sso_recuperar_origem_xlsx(c,'origem-700');
 if v <> jsonb_build_object('estado','encontrada','loteId',l,'revisao',1,'sha256',h) then raise exception 'origem recuperada incorreta: %',v; end if;
 begin perform pcm.sso_recuperar_origem_xlsx('16891000-0000-4000-8000-000000000003','origem-700'); raise exception 'outro cliente aceito'; exception when insufficient_privilege then null; end;
 perform pcm.sso_receber_cronograma_mediado('16900000-0000-4000-8000-000000000703','16900000-0000-4000-8000-000000000704',c,'csv-700','[[1],[2],[3],[4],[5]]');
 v := pcm.sso_recuperar_origem_xlsx(c,'csv-700');
 if v <> '{"estado":"reconciliacao"}'::jsonb then raise exception 'CSV tratado como XLSX'; end if;
end $$;
reset role;
update pcm.sso_origem_xlsx_cronograma_gate set habilitado=false where id;
set local role authenticated;
do $$begin
 begin perform pcm.sso_recuperar_origem_xlsx('16891000-0000-4000-8000-000000000002','origem-700'); raise exception 'gate ignorado';
 exception when sqlstate '55000' then if sqlerrm <> 'origem_xlsx_bloqueada' then raise; end if; end;
end$$;
reset role;
do $$begin
 if not has_function_privilege('authenticated','pcm.sso_recuperar_origem_xlsx(uuid,text)','execute')
 or has_function_privilege('anon','pcm.sso_recuperar_origem_xlsx(uuid,text)','execute')
 or has_function_privilege('service_role','pcm.sso_recuperar_origem_xlsx(uuid,text)','execute') then raise exception 'grants incorretos'; end if;
end$$;
rollback;
