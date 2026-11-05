-- Apenas clone descartável, migration 1813; sem comprovar acesso positivo.
begin;
do $$ begin
 if (select habilitado from pcm.sso_hierarquia_grupos_mediada_gate where id) is distinct from false then raise exception 'gate_inicial_invalido'; end if;
 if not has_function_privilege('authenticated','pcm.sso_listar_hierarquia_grupos_mediada(uuid,uuid,uuid,integer)','execute')
 or has_function_privilege('anon','pcm.sso_listar_hierarquia_grupos_mediada(uuid,uuid,uuid,integer)','execute')
 or has_function_privilege('authenticated','pcm.sso_listar_hierarquia_grupos(uuid,uuid,integer)','execute') then raise exception 'acl_invalida'; end if;
end $$;
set local role authenticated;
set local request.jwt.claims='{"sub":"18130000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
do $$ begin
 begin
  perform * from pcm.sso_listar_hierarquia_grupos_mediada('18130000-0000-4000-8000-000000000002','18130000-0000-4000-8000-000000000003',null,20);
  raise exception 'ator_divergente_aceito';
 exception when insufficient_privilege then null; end;
 begin
  perform * from pcm.sso_listar_hierarquia_grupos_mediada('18130000-0000-4000-8000-000000000001','18130000-0000-4000-8000-000000000003',null,20);
  raise exception 'gate_fechado_aceito';
 exception when sqlstate '55000' then null; end;
end $$;
reset role;
rollback;
