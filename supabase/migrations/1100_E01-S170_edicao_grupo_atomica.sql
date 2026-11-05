-- ADR-0947: invoker preserva RLS; sem execução concedida até revisão.
create function config.sso_editar_grupo_atomico(p_id uuid,p_patch jsonb,p_permissoes jsonb,p_estado_esperado jsonb,p_ator_esperado uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_par jsonb;v_atual jsonb;
begin
  if auth.uid() is null or p_ator_esperado is distinct from auth.uid() or p_id is null or jsonb_typeof(p_patch) is distinct from 'object'
    or jsonb_typeof(p_estado_esperado) is distinct from 'object'
    or (p_patch - 'nome' - 'descricao' - 'ativo') <> '{}'::jsonb
    or (p_patch ? 'nome' and (jsonb_typeof(p_patch->'nome') is distinct from 'string' or length(btrim(p_patch->>'nome'))=0))
    or (p_patch ? 'descricao' and jsonb_typeof(p_patch->'descricao') not in ('string','null'))
    or (p_patch ? 'ativo' and jsonb_typeof(p_patch->'ativo') is distinct from 'boolean')
    or (p_permissoes is not null and jsonb_typeof(p_permissoes) is distinct from 'array') then
    raise exception 'parametros_invalidos' using errcode='22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  if not exists(select 1 from config.usuarios u where u.user_id=auth.uid() and u.ativo and u.papel in ('superadmin','supervisor')) then
    raise exception 'sem_acesso' using errcode='42501';
  end if;
  perform 1 from config.grupos where id=p_id for update;
  if not found then raise exception 'grupo_indisponivel' using errcode='42501'; end if;
  select jsonb_build_object('nome',g.nome,'descricao',g.descricao,'ativo',g.ativo,
    'permissoes',coalesce((select jsonb_agg(jsonb_build_object('modulo',m.modulo,'nivel',m.nivel) order by m.modulo) from config.grupo_modulos m where m.grupo_id=g.id),'[]'::jsonb))
    into v_atual from config.grupos g where g.id=p_id;
  if v_atual is distinct from p_estado_esperado then raise exception 'grupo_alterado' using errcode='40001'; end if;
  if p_permissoes is not null then
    if jsonb_array_length(p_permissoes)>9 then raise exception 'permissoes_invalidas' using errcode='22023'; end if;
    for v_par in select value from jsonb_array_elements(p_permissoes) loop
      if jsonb_typeof(v_par) is distinct from 'object' or (v_par - 'modulo' - 'nivel') <> '{}'::jsonb
        or jsonb_typeof(v_par->'modulo') is distinct from 'string' or jsonb_typeof(v_par->'nivel') is distinct from 'string'
        or v_par->>'modulo' not in ('pcm','atendimento','comercial','financeiro','operacao','marketing','growth','gestao','area-cliente')
        or v_par->>'nivel' not in ('leitura','escrita') then raise exception 'permissoes_invalidas' using errcode='22023'; end if;
    end loop;
    if (select count(distinct x.value->>'modulo') from jsonb_array_elements(p_permissoes) x) <> jsonb_array_length(p_permissoes) then raise exception 'modulos_duplicados' using errcode='22023'; end if;
  end if;
  update config.grupos set
    nome=case when p_patch ? 'nome' then p_patch->>'nome' else nome end,
    descricao=case when p_patch ? 'descricao' then p_patch->>'descricao' else descricao end,
    ativo=case when p_patch ? 'ativo' then (p_patch->>'ativo')::boolean else ativo end
    where id=p_id;
  if not found then raise exception 'grupo_indisponivel' using errcode='42501'; end if;
  if p_permissoes is not null then
    delete from config.grupo_modulos where grupo_id=p_id;
    insert into config.grupo_modulos(grupo_id,modulo,nivel)
      select p_id,x.value->>'modulo',x.value->>'nivel' from jsonb_array_elements(p_permissoes) x;
  end if;
end; $$;
revoke all on function config.sso_editar_grupo_atomico(uuid,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated,service_role;
