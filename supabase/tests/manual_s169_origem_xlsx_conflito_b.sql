\set ON_ERROR_STOP on
do $$begin if current_database() <> 'sso_s169_descartavel' then raise exception 'banco nao descartavel'; end if; end$$;
begin;
set local test.uid='16891000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
  begin
    perform pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000221','16900000-0000-4000-8000-000000000222','16891000-0000-4000-8000-000000000002','conflito','[[1],[2],[3],[4],[5]]','ZGVm','cb8379ac2098aa165029e3938a51da0bcecfc008fd6795f401178647f96c5b34');
    raise exception 'arquivo divergente foi aceito';
  exception when sqlstate '23505' then if sqlerrm <> 'origem_xlsx_conflitante' then raise; end if; end;
end$$;
commit;
