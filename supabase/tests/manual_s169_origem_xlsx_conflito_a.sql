\set ON_ERROR_STOP on
do $$begin if current_database() <> 'sso_s169_descartavel' then raise exception 'banco nao descartavel'; end if; end$$;
begin;
set local test.uid='16891000-0000-4000-8000-000000000001';
set local role authenticated;
select pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000221','16900000-0000-4000-8000-000000000222','16891000-0000-4000-8000-000000000002','conflito','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
select pg_sleep(8);
commit;
