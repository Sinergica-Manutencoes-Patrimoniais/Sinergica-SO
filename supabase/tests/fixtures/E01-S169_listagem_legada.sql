-- Apenas banco sintético dedicado, nunca executar em banco oficial.
\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database() <> 'sso_transporte_169' THEN RAISE EXCEPTION 'banco_sintetico_obrigatorio'; END IF; END $$;
begin;
do $$
begin
 begin
  perform pcm.sso_listar_cronogramas_legados('00000000-0000-0000-0000-000000000020',null,1);
  raise exception 'gate de leitura abriu indevidamente';
 exception when sqlstate '55000' then null; end;
end $$;
update pcm.sso_listagem_cronograma_legado_gate set habilitado=true;
create or replace function config.sso_autorizar_acao(text,uuid) returns boolean language sql stable as $$
 select $2='00000000-0000-0000-0000-000000000020'::uuid and current_setting('sso.permitir',true)='sim'
$$;
select set_config('sso.permitir','sim',true);
do $$
declare n integer; r record;
begin
 select count(*) into n from pcm.sso_listar_cronogramas_legados('00000000-0000-0000-0000-000000000020',null,1);
 if n<>1 then raise exception 'listagem incorreta'; end if;
 select * into r from pcm.sso_listar_cronogramas_legados('00000000-0000-0000-0000-000000000020',null,1);
 if r.id <> '00000000-0000-0000-0000-000000000010' or r.revisao<>2 or r.reconciliado then raise exception 'metadados incorretos'; end if;
 select count(*) into n from pcm.sso_listar_cronogramas_legados('00000000-0000-0000-0000-000000000020',r.id,1);
 if n<>0 then raise exception 'cursor incorreto'; end if;
 begin
   perform pcm.sso_listar_cronogramas_legados('00000000-0000-0000-0000-000000000020',null,101);
   raise exception 'limite não rejeitado';
 exception when invalid_parameter_value then null; end;
 begin
   perform pcm.sso_listar_cronogramas_legados('00000000-0000-0000-0000-000000000021',null,1);
   raise exception 'outro Cliente acessível';
 exception when insufficient_privilege then null; end;
 perform set_config('sso.permitir','nao',true);
 begin
   perform pcm.sso_listar_cronogramas_legados('00000000-0000-0000-0000-000000000020',null,1);
   raise exception 'permissão revogada ignorada';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
