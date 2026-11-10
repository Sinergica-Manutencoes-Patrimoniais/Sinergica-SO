-- ADR-1231: observação agregada interna; não avança execução nem comprova efeito remoto.
create function pcm.sso_diagnosticar_executor_varredura_fila()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_config pcm.sso_executor_varredura_fila%rowtype;
  v_execucao pcm.sso_execucoes_varredura_fila%rowtype;
begin
  select * into v_config from pcm.sso_executor_varredura_fila where id;
  if not found then raise exception 'executor_indisponivel' using errcode='55000'; end if;
  if v_config.execucao_atual is null then
    return jsonb_build_object('habilitado',v_config.habilitado,'intervaloMinutos',v_config.intervalo_minutos,
      'ultimaConclusao',v_config.ultima_conclusao,'execucaoAtual',null,'efeitoRemotoComprovado',false);
  end if;
  select * into v_execucao from pcm.sso_execucoes_varredura_fila where id=v_config.execucao_atual;
  if not found then raise exception 'execucao_inconsistente' using errcode='23514'; end if;
  return jsonb_build_object('habilitado',v_config.habilitado,'intervaloMinutos',v_config.intervalo_minutos,
    'ultimaConclusao',v_config.ultima_conclusao,'execucaoAtual',jsonb_build_object(
      'id',v_execucao.id,'estado',v_execucao.estado,'revisao',v_execucao.revisao,
      'considerados',v_execucao.considerados,'alterados',v_execucao.alterados,
      'criadaEm',v_execucao.criada_em,'atualizadaEm',v_execucao.atualizada_em),
    'efeitoRemotoComprovado',false);
end; $$;
revoke all on function pcm.sso_diagnosticar_executor_varredura_fila() from public,anon,authenticated,service_role;
grant execute on function pcm.sso_diagnosticar_executor_varredura_fila() to service_role;
