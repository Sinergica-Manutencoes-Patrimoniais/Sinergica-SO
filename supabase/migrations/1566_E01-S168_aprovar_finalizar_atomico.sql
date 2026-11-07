-- ADR-1423: composição transacional, desligada por padrão.
create table pcm.sso_aprovacao_finalizacao_atomica_gate (
  id boolean primary key default true check (id),
  habilitado boolean not null default false
);
insert into pcm.sso_aprovacao_finalizacao_atomica_gate(id, habilitado) values (true, false);
alter table pcm.sso_aprovacao_finalizacao_atomica_gate enable row level security;
alter table pcm.sso_aprovacao_finalizacao_atomica_gate force row level security;
revoke all on pcm.sso_aprovacao_finalizacao_atomica_gate from public, anon, authenticated, service_role;

create function pcm.sso_aprovar_finalizar_os_atomico(
  p_request_id uuid, p_cliente_id uuid, p_retorno_id uuid, p_conferencia_id uuid,
  p_expected_evidencias integer, p_expected_decisao integer, p_justificativa text,
  p_expected_os_id uuid, p_expected_status text, p_expected_updated_at timestamptz
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_aprovacao jsonb; v_finalizacao jsonb;
begin
  perform 1 from pcm.sso_aprovacao_finalizacao_atomica_gate where id and habilitado for share;
  if not found then raise exception 'aprovacao_atomica_bloqueada' using errcode = '55000'; end if;
  if auth.uid() is null or p_request_id is null or p_expected_os_id is null or
     p_expected_decisao is null or p_expected_decisao < 0 or p_expected_decisao >= 2147483647 or
     config.sso_autorizar_acao('execucao.validar', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso_ou_parametros_invalidos' using errcode = '42501';
  end if;
  -- Ambas as funções preservam seus controles de autorização, gates e replay.
  v_aprovacao := pcm.sso_atestar_aprovar_retorno_pcm(p_request_id, p_cliente_id, p_retorno_id,
    p_conferencia_id, p_expected_evidencias, p_expected_decisao, p_justificativa);
  if v_aprovacao->>'requestId' is distinct from p_request_id::text or
     v_aprovacao->>'retornoId' is distinct from p_retorno_id::text or
     (v_aprovacao->>'revision')::integer is distinct from p_expected_decisao + 1 then
    raise exception 'aprovacao_inconsistente' using errcode = '23514';
  end if;
  v_finalizacao := pcm.sso_mediar_finalizacao_os(p_request_id, p_cliente_id, p_retorno_id,
    p_expected_os_id, p_request_id, p_expected_decisao + 1, p_expected_status, p_expected_updated_at);
  if v_finalizacao->>'requestId' is distinct from p_request_id::text or
     v_finalizacao->>'retornoId' is distinct from p_retorno_id::text or
     v_finalizacao->>'osId' is distinct from p_expected_os_id::text or
     v_finalizacao->>'status' is distinct from 'finalizado' or
     v_finalizacao->'chamadoAlterado' is distinct from 'false'::jsonb then
    raise exception 'finalizacao_inconsistente' using errcode = '23514';
  end if;
  return jsonb_build_object('requestId', p_request_id, 'retornoId', p_retorno_id,
    'osId', p_expected_os_id, 'revision', p_expected_decisao + 1,
    'pendenciasProcessadas', v_aprovacao->'pendenciasProcessadas',
    'osEncerrada', true, 'chamadoAlterado', false, 'conteudoAutenticado', false);
end; $$;
revoke all on function pcm.sso_aprovar_finalizar_os_atomico(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function pcm.sso_aprovar_finalizar_os_atomico(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text,timestamptz)
  to authenticated;
