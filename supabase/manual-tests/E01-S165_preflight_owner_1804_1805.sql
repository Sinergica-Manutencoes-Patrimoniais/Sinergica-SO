-- Somente leitura; executar por operador autorizado após aplicar 1804/1805/1806 em clone ou destino.
-- Exige gates desligados. Não expõe conteúdo de linhas, não altera permissões nem habilita gates.
-- psql -X -v ON_ERROR_STOP=1 -f ... ; qualquer erro significa pré-condição não comprovada.
begin read only;
do $$
declare
  assinatura text; f oid; r record; tabela text; t oid; papel text; permissao text;
  f_previa oid := to_regprocedure('pcm.sso_preparar_aprovacao_versao(uuid,uuid,uuid,integer)');
  f_borda oid := to_regprocedure('pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean)');
  f_guarda oid := to_regprocedure('pcm.sso_exigir_token_versao_aprovacao(uuid,uuid,uuid,integer,date,uuid)');
  f_gate oid := to_regprocedure('pcm.sso_versao_aprovacao_exigida()');
  f_nucleo oid := to_regprocedure('pcm.sso_aprovar_plano(uuid,integer,uuid,date)');
  d text;
begin
  if f_previa is null or f_borda is null or f_guarda is null or f_gate is null or f_nucleo is null then
    raise exception 'preflight: função esperada ausente' using errcode='55000'; end if;
  foreach assinatura in array array[
    'pcm.sso_aprovacao_versao_esperada_gate',
    'pcm.sso_exigir_versao_aprovacao_gate',
    'pcm.sso_aprovacao_versao_tokens'
  ] loop
    t := to_regclass(assinatura);
    if t is null or not exists(select 1 from pg_catalog.pg_class c where c.oid=t and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity) then
      raise exception 'preflight: tabela protegida ausente ou RLS/FORCE desligada: %', assinatura using errcode='55000'; end if;
    foreach papel in array array['anon','authenticated','service_role'] loop
      foreach permissao in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if pg_catalog.has_table_privilege(papel,t,permissao) then
          raise exception 'preflight: privilégio inesperado em tabela protegida: % / % / %', assinatura,papel,permissao using errcode='42501'; end if;
      end loop;
    end loop;
  end loop;
  foreach f in array array[f_previa,f_borda,f_guarda,f_gate,f_nucleo] loop
    select p.prosecdef,p.proowner,rr.rolsuper,rr.rolbypassrls into r
      from pg_catalog.pg_proc p join pg_catalog.pg_roles rr on rr.oid=p.proowner where p.oid=f;
    if not found or not r.prosecdef or not (r.rolsuper or r.rolbypassrls) then
      raise exception 'preflight: SECURITY DEFINER ou BYPASSRLS do proprietário incompatível: %', f::regprocedure using errcode='42501'; end if;
    if not pg_catalog.has_schema_privilege(r.proowner,'pcm','USAGE') then
      raise exception 'preflight: proprietário sem USAGE no schema pcm: %', f::regprocedure using errcode='42501'; end if;
  end loop;
  foreach f in array array[f_previa,f_borda] loop
    if not pg_catalog.has_function_privilege('authenticated',f,'EXECUTE')
      or pg_catalog.has_function_privilege('anon',f,'EXECUTE') then
      raise exception 'preflight: ACL da borda incompatível: %', f::regprocedure using errcode='42501'; end if;
  end loop;
  -- FOR SHARE/UPDATE exige SELECT e UPDATE das linhas bloqueadas; conferir como o owner efetivo.
  foreach f in array array[f_previa,f_borda] loop
    select p.proowner into r from pg_catalog.pg_proc p where p.oid=f;
    foreach tabela in array array['pcm.sso_aprovacao_versao_esperada_gate','pcm.planos_manutencao','pcm.plano_versoes'] loop
      foreach permissao in array array['SELECT','UPDATE'] loop
        if not pg_catalog.has_table_privilege(r.proowner,to_regclass(tabela),permissao) then
          raise exception 'preflight: proprietário da borda sem % em %',permissao,tabela using errcode='42501'; end if;
      end loop;
    end loop;
  end loop;
  foreach papel in array array['anon','authenticated','service_role'] loop
    if pg_catalog.has_function_privilege(papel,f_guarda,'EXECUTE')
      or pg_catalog.has_function_privilege(papel,f_gate,'EXECUTE') then
      raise exception 'preflight: helper privado executável por %',papel using errcode='42501'; end if;
  end loop;
  select p.proowner into r from pg_catalog.pg_proc p where p.oid=f_borda;
  if not pg_catalog.has_function_privilege(r.proowner,f_gate,'EXECUTE') then
    raise exception 'preflight: proprietário da borda sem EXECUTE do helper de gate' using errcode='42501'; end if;
  t := to_regclass('pcm.sso_aprovacao_versao_tokens');
  foreach permissao in array array['SELECT','INSERT','DELETE'] loop
    if not pg_catalog.has_table_privilege(r.proowner,t,permissao) then
      raise exception 'preflight: proprietário da borda sem privilégio de token: %',permissao using errcode='42501'; end if;
  end loop;
  select p.proowner into r from pg_catalog.pg_proc p where p.oid=f_guarda;
  foreach tabela in array array['pcm.sso_exigir_versao_aprovacao_gate','pcm.sso_aprovacao_versao_tokens'] loop
    if not pg_catalog.has_table_privilege(r.proowner,to_regclass(tabela),'SELECT') then
      raise exception 'preflight: proprietário da guarda sem SELECT em %',tabela using errcode='42501'; end if;
  end loop;
  if not pg_catalog.has_table_privilege(r.proowner,to_regclass('pcm.sso_exigir_versao_aprovacao_gate'),'UPDATE') then
    raise exception 'preflight: proprietário da guarda sem UPDATE para trava do gate' using errcode='42501'; end if;
  select p.proowner into r from pg_catalog.pg_proc p where p.oid=f_gate;
  foreach permissao in array array['SELECT','UPDATE'] loop
    if not pg_catalog.has_table_privilege(r.proowner,to_regclass('pcm.sso_exigir_versao_aprovacao_gate'),permissao) then
      raise exception 'preflight: proprietário do helper de gate sem % para trava',permissao using errcode='42501'; end if;
  end loop;
  select p.proowner into r from pg_catalog.pg_proc p where p.oid=f_nucleo;
  if not pg_catalog.has_function_privilege(r.proowner,f_guarda,'EXECUTE') then
    raise exception 'preflight: proprietário do núcleo sem EXECUTE da guarda' using errcode='42501'; end if;
  d := pg_catalog.pg_get_functiondef(f_nucleo);
  if strpos(d,'sso_exigir_token_versao_aprovacao')=0 then
    raise exception 'preflight: guarda ausente no núcleo' using errcode='55000'; end if;
  d := pg_catalog.pg_get_functiondef(f_borda);
  if strpos(d,'insert into pcm.sso_aprovacao_versao_tokens')=0 or strpos(d,'delete from pcm.sso_aprovacao_versao_tokens')=0 then
    raise exception 'preflight: ciclo de token ausente na borda' using errcode='55000'; end if;
  if (length(d)-length(replace(d,'v_comando.request_id is null and pcm.sso_versao_aprovacao_exigida()','')))
      / length('v_comando.request_id is null and pcm.sso_versao_aprovacao_exigida()') <> 2 then
    raise exception 'preflight: marcadores de compatibilidade 1806 ausentes ou divergentes' using errcode='55000'; end if;
  if (select count(*) from pcm.sso_aprovacao_versao_esperada_gate where id and not habilitado)<>1
    or (select count(*) from pcm.sso_exigir_versao_aprovacao_gate where id and not habilitado)<>1 then
    raise exception 'preflight: gate ausente ou habilitado; exige revisão operacional' using errcode='55000'; end if;
  if exists(select 1 from pcm.sso_aprovacao_versao_tokens) then
    raise exception 'preflight: token persistido visível exige investigação' using errcode='55000'; end if;
end; $$;
rollback;
