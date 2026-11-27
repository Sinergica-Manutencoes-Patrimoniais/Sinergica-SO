-- E01-S200: aplica a matriz ao RPC manual e serializa a leitura da origem e a escrita.
create or replace function pcm.fn_operacao_alterar_status_lote(
  p_ids uuid[],
  p_status text
)
returns table (
  id uuid,
  sucesso boolean,
  erro text
)
language plpgsql
security invoker
set search_path = pcm, public
as $$
declare
  v_id uuid;
  v_cliente_id uuid;
  v_origem text;
  v_permitida boolean;
begin
  -- Achado de revisão (0178 original): `p_status is null` faz `p_status not in (...)` avaliar
  -- NULL, não true — o `if` nunca dispara e o UPDATE abaixo gravaria status NULL na OS. Pré
  -- existente, corrigido junto por tocar esta função na mesma story.
  if p_status is null or p_status not in (
    'solicitacao', 'corretiva', 'backlog', 'planejamento',
    'em_execucao', 'validacao_pcm', 'finalizado', 'cancelado'
  ) then
    raise exception 'Status de OS inválido: %', p_status using errcode = '22023';
  end if;

  foreach v_id in array coalesce(p_ids, array[]::uuid[])
  loop
    begin
      id := v_id;
      select os.client_id, os.status into v_cliente_id, v_origem
        from pcm.ordens_servico os
        where os.id = v_id and os.deleted_at is null
        for update;
      if not found then
        sucesso := false;
        erro := 'OS não encontrada ou sem permissão';
        return next;
        continue;
      end if;

      if p_status = 'finalizado'
        and config.sso_autorizar_acao('execucao.validar', v_cliente_id) is distinct from true then
        sucesso := false;
        erro := 'sem_acesso';
        return next;
        continue;
      end if;

      if v_origem = p_status then
        sucesso := true;
        erro := null;
        return next;
        continue;
      end if;

      -- Espelha o domínio transicoes-os.ts. Escritores de campo não passam por este RPC.
      v_permitida := case v_origem
        when 'solicitacao' then p_status in ('planejamento', 'cancelado')
        when 'planejamento' then p_status in ('em_execucao', 'solicitacao', 'cancelado')
        when 'em_execucao' then p_status in ('validacao_pcm', 'planejamento', 'cancelado')
        when 'validacao_pcm' then p_status in ('finalizado', 'em_execucao', 'planejamento', 'cancelado')
        when 'corretiva' then p_status in ('solicitacao', 'planejamento', 'em_execucao', 'validacao_pcm', 'cancelado')
        when 'backlog' then p_status in ('solicitacao', 'planejamento', 'cancelado')
        else false
      end;
      if not v_permitida then
        sucesso := false;
        erro := case
          when v_origem = 'finalizado' then 'OS finalizada exige reabertura pelo fluxo próprio.'
          when v_origem = 'cancelado' then 'OS cancelada exige reativação pelo fluxo próprio.'
          when p_status = 'finalizado' then 'A OS só é finalizada depois da validação do PCM.'
          else 'Movimentação fora do fluxo aprovado. Confira a fase atual da OS.'
        end;
        return next;
        continue;
      end if;

      update pcm.ordens_servico os
      set status = p_status,
          updated_at = now(),
          updated_by = auth.uid()
      where os.id = v_id
        and os.deleted_at is null;

      id := v_id;
      sucesso := found;
      erro := case when found then null else 'OS não encontrada ou sem permissão' end;
      return next;
    exception when others then
      id := v_id;
      sucesso := false;
      erro := sqlerrm;
      return next;
    end;
  end loop;
end;
$$;
