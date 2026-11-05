-- ADR-0947: criação e módulos em uma transação, respeitando RLS do chamador.
create function config.sso_criar_grupo_atomico(p_id uuid,p_nome text,p_descricao text,p_permissoes jsonb,p_ator_esperado uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_par jsonb;
begin
  if auth.uid() is null or p_ator_esperado is distinct from auth.uid() or p_id is null or p_nome is null or length(btrim(p_nome))=0
    or jsonb_typeof(p_permissoes) is distinct from 'array' or jsonb_array_length(p_permissoes)>9 then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  if not exists(select 1 from config.usuarios u where u.user_id=auth.uid() and u.ativo and u.papel in ('superadmin','supervisor')) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  for v_par in select value from jsonb_array_elements(p_permissoes) loop
    if jsonb_typeof(v_par) is distinct from 'object' or (v_par - 'modulo' - 'nivel') <> '{}'::jsonb
      or jsonb_typeof(v_par->'modulo') is distinct from 'string' or jsonb_typeof(v_par->'nivel') is distinct from 'string'
      or v_par->>'modulo' not in ('pcm','atendimento','comercial','financeiro','operacao','marketing','growth','gestao','area-cliente')
      or v_par->>'nivel' not in ('leitura','escrita') then raise exception 'permissoes_invalidas' using errcode='22023'; end if;
  end loop;
  if (select count(distinct x.value->>'modulo') from jsonb_array_elements(p_permissoes) x) <> jsonb_array_length(p_permissoes) then raise exception 'modulos_duplicados' using errcode='22023'; end if;
  insert into config.grupos(id,nome,descricao,created_by) values(p_id,p_nome,p_descricao,auth.uid());
  insert into config.grupo_modulos(grupo_id,modulo,nivel,created_by)
    select p_id,x.value->>'modulo',x.value->>'nivel',auth.uid() from jsonb_array_elements(p_permissoes) x;
end; $$;
revoke all on function config.sso_criar_grupo_atomico(uuid,text,text,jsonb,uuid) from public,anon,authenticated,service_role;
