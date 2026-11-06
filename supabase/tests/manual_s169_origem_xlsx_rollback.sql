\set ON_ERROR_STOP on
do $$begin if current_database() <> 'sso_s169_descartavel' then raise exception 'banco nao descartavel'; end if; end$$;
begin;
create function pcm.sso_teste_falha_origem() returns trigger language plpgsql as $$begin raise exception 'falha_sintetica_origem' using errcode='P0001'; end$$;
create trigger sso_teste_falha_origem before insert on pcm.sso_origens_xlsx_cronograma for each row execute function pcm.sso_teste_falha_origem();
set local test.uid='16891000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 begin
  perform pcm.sso_receber_xlsx_cronograma('16900000-0000-4000-8000-000000000231','16900000-0000-4000-8000-000000000232','16891000-0000-4000-8000-000000000002','rollback','[[1],[2],[3],[4],[5]]','YWJj','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  raise exception 'falha nao propagada';
 exception when sqlstate 'P0001' then if sqlerrm <> 'falha_sintetica_origem' then raise; end if; end;
end$$;
reset role;
do $$begin
 if exists(select 1 from pcm.sso_levantamentos where id='16900000-0000-4000-8000-000000000232') then raise exception 'lote sobreviveu a falha'; end if;
 if exists(select 1 from pcm.sso_levantamento_comandos where request_id='16900000-0000-4000-8000-000000000231') then raise exception 'comando sobreviveu a falha'; end if;
 if exists(select 1 from audit.events where entity_id='16900000-0000-4000-8000-000000000232') then raise exception 'auditoria sobreviveu a falha'; end if;
end$$;
rollback;
