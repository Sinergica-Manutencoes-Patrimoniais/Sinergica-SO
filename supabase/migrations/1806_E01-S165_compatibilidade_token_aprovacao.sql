-- ADR-1664: compatibilidade da borda 1804 com o gate 1805 fechado.
create function pcm.sso_versao_aprovacao_exigida() returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v_habilitado boolean;
begin
  select habilitado into v_habilitado from pcm.sso_exigir_versao_aprovacao_gate where id for share nowait;
  if not found then raise exception 'gate_indisponivel' using errcode='55000'; end if;
  return v_habilitado;
end; $$;
revoke all on function pcm.sso_versao_aprovacao_exigida() from public,anon,authenticated,service_role;

-- A migration aborta se os proprietários não puderem operar com FORCE RLS.
do $preflight$
declare
  v_borda oid; v_guarda oid; v_gate oid; v_nucleo oid;
  r record; v_rel regclass;
begin
  select proowner into v_borda from pg_proc where oid='pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean)'::regprocedure and prosecdef;
  select proowner into v_guarda from pg_proc where oid='pcm.sso_exigir_token_versao_aprovacao(uuid,uuid,uuid,integer,date,uuid)'::regprocedure and prosecdef;
  select proowner into v_gate from pg_proc where oid='pcm.sso_versao_aprovacao_exigida()'::regprocedure and prosecdef;
  select proowner into v_nucleo from pg_proc where oid='pcm.sso_aprovar_plano(uuid,integer,uuid,date)'::regprocedure and prosecdef;
  if v_borda is null or v_guarda is null or v_gate is null or v_nucleo is null then raise exception 'owners_aprovacao_invalidos' using errcode='55000'; end if;
  for r in select oid,rolsuper,rolbypassrls from pg_roles where oid in (v_borda,v_guarda,v_gate) loop
    if not (r.rolsuper or r.rolbypassrls) then raise exception 'owner_sem_bypass_rls' using errcode='55000'; end if;
  end loop;
  if not has_schema_privilege(v_borda,'pcm','USAGE')
    or not has_schema_privilege(v_guarda,'pcm','USAGE')
    or not has_schema_privilege(v_gate,'pcm','USAGE')
    or not has_schema_privilege(v_nucleo,'pcm','USAGE')
    or not has_table_privilege(v_borda,'pcm.sso_aprovacao_versao_tokens','INSERT')
    or not has_table_privilege(v_borda,'pcm.sso_aprovacao_versao_tokens','DELETE')
    or not has_table_privilege(v_guarda,'pcm.sso_aprovacao_versao_tokens','SELECT')
    or not has_table_privilege(v_guarda,'pcm.sso_exigir_versao_aprovacao_gate','SELECT')
    or not has_table_privilege(v_guarda,'pcm.sso_exigir_versao_aprovacao_gate','UPDATE')
    or not has_table_privilege(v_gate,'pcm.sso_exigir_versao_aprovacao_gate','SELECT')
    or not has_table_privilege(v_gate,'pcm.sso_exigir_versao_aprovacao_gate','UPDATE')
    or not has_function_privilege(v_borda,'pcm.sso_versao_aprovacao_exigida()','EXECUTE')
    or not has_function_privilege(v_nucleo,'pcm.sso_exigir_token_versao_aprovacao(uuid,uuid,uuid,integer,date,uuid)','EXECUTE') then
    raise exception 'privilegios_aprovacao_insuficientes' using errcode='55000'; end if;
  if exists(select 1 from pg_roles u where u.rolname in ('anon','authenticated','service_role')
      and (has_function_privilege(u.oid,'pcm.sso_versao_aprovacao_exigida()','EXECUTE')
        or has_function_privilege(u.oid,'pcm.sso_exigir_token_versao_aprovacao(uuid,uuid,uuid,integer,date,uuid)','EXECUTE'))) then
    raise exception 'helper_aprovacao_exposto' using errcode='55000'; end if;
  foreach v_rel in array array['pcm.sso_aprovacao_versao_tokens'::regclass,'pcm.sso_exigir_versao_aprovacao_gate'::regclass] loop
    if exists(select 1 from pg_class c where c.oid=v_rel and (not c.relrowsecurity or not c.relforcerowsecurity))
      or exists(select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid=v_rel and a.grantee=0)
      or exists(select 1 from pg_roles u where u.rolname in ('anon','authenticated','service_role')
        and (has_table_privilege(u.oid,v_rel,'SELECT') or has_table_privilege(u.oid,v_rel,'INSERT')
          or has_table_privilege(u.oid,v_rel,'UPDATE') or has_table_privilege(u.oid,v_rel,'DELETE'))) then
      raise exception 'acl_aprovacao_exposta' using errcode='55000'; end if;
  end loop;
end; $preflight$;

-- O comprovante só é necessário para um pedido novo com a proteção ativa.
do $patch$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aprovar_versao_esperada(uuid,uuid,uuid,integer,uuid,uuid,date,boolean)'::regprocedure);
  a text:=$a$  insert into pcm.sso_aprovacao_versao_tokens(txid,request_id,ator_id,cliente_id,plano_id,versao_id,revisao,vigencia)
    values(pg_catalog.txid_current(),p_request,p_ator,p_cliente,p_plano,p_versao,p_revisao,p_vigencia);$a$;
  b text:=$b$  if v_comando.request_id is null and pcm.sso_versao_aprovacao_exigida() then
    insert into pcm.sso_aprovacao_versao_tokens(txid,request_id,ator_id,cliente_id,plano_id,versao_id,revisao,vigencia)
      values(pg_catalog.txid_current(),p_request,p_ator,p_cliente,p_plano,p_versao,p_revisao,p_vigencia);
  end if;$b$;
  c text:=$c$  delete from pcm.sso_aprovacao_versao_tokens where txid=pg_catalog.txid_current() and request_id=p_request;$c$;
  e text:=$e$  if v_comando.request_id is null and pcm.sso_versao_aprovacao_exigida() then
    delete from pcm.sso_aprovacao_versao_tokens where txid=pg_catalog.txid_current() and request_id=p_request;
  end if;$e$;
begin
  if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,c,'')))/length(c)<>1
    or strpos(d,'sso_versao_aprovacao_exigida')>0 then raise exception 'aprovacao_versao_incompativel' using errcode='55000'; end if;
  execute replace(replace(d,a,b),c,e);
end; $patch$;
