-- ADR-0204: consulta privada; nenhuma alteração operacional.
create function pcm.sso_consultar_resolucao_origem(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_cmd pcm.sso_origem_campo_resolucao_comandos%rowtype;
begin
  if p_request_id is null or config.sso_autorizar_triagem_global() is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_cmd from pcm.sso_origem_campo_resolucao_comandos where request_id=p_request_id and ator_id=auth.uid();
  if not found or config.sso_autorizar_acao('integracao.reconciliar',v_cmd.cliente_id) is not true then raise exception 'tentativa_indisponivel' using errcode='42501'; end if;
  return v_cmd.resultado;
end;
$$;
revoke all on function pcm.sso_consultar_resolucao_origem(uuid) from public,anon,authenticated,service_role;
