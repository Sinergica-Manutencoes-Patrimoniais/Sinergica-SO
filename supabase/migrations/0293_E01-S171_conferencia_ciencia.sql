-- ADR-0069: consulta informativa, sem habilitar envio ou criar efeitos.
create function pcm.sso_conferir_ciencia_visita(p_visita_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_visita pcm.visitas%rowtype; v_confirmacao pcm.visita_confirmacoes%rowtype;
  v_modo text; v_origem text; v_politica_id uuid; v_politica_revisao integer;
  v_ciencia boolean := false; v_situacao text;
begin
  if p_visita_id is null then raise exception 'consulta_invalida' using errcode = '22023'; end if;
  select * into v_visita from pcm.visitas where id = p_visita_id;
  if not found or not config.sso_autorizar_acao('visita.confirmar', v_visita.cliente_id) then
    raise exception 'visita_nao_encontrada_ou_sem_acesso' using errcode = '42501';
  end if;
  select r.modo, r.origem, r.politica_id, r.politica_revisao into v_modo, v_origem, v_politica_id, v_politica_revisao
    from pcm.sso_resolver_ciencia_visita(p_visita_id) r;
  if v_visita.estado = 'confirmada' then
    select * into v_confirmacao from pcm.visita_confirmacoes
      where visita_id = p_visita_id and cliente_id = v_visita.cliente_id and revisao = v_visita.revisao;
  end if;
  if v_confirmacao.id is null then v_situacao := 'pendente_pcm';
  else
    select exists (select 1 from pcm.visita_ciencias c where c.visita_id = p_visita_id and c.cliente_id = v_visita.cliente_id
      and c.ciencia_em <= statement_timestamp()
      and ((c.confirmacao_id = v_confirmacao.id and c.revisao_visita = v_confirmacao.revisao)
        or (c.confirmacao_id is null and c.revisao_visita = v_confirmacao.revisao - 1))) into v_ciencia;
    v_situacao := case when v_modo <> 'obrigatoria' then 'nao_exigida'
      when v_ciencia then 'ciencia_conferida' else 'ciencia_pendente' end;
  end if;
  return jsonb_build_object('visitaId', p_visita_id, 'revision', v_visita.revisao,
    'situacao', v_situacao, 'politicaModo', v_modo, 'politicaOrigem', v_origem,
    'politicaId', v_politica_id, 'politicaRevisao', v_politica_revisao,
    'confirmacaoId', v_confirmacao.id, 'cienciaEncontrada', v_ciencia,
    'autorizaEnvio', false);
end;
$$;
revoke all on function pcm.sso_conferir_ciencia_visita(uuid) from public, anon;
grant execute on function pcm.sso_conferir_ciencia_visita(uuid) to authenticated;
