-- E01-S185: corrige um bug REAL, encontrado pelo pgTAP novo de AC-1 — não é refatoração.
--
-- pcm.sso_listar_outbox_reconciliacao e pcm.sso_listar_outbox_reconciliacao_filtrada declaram uma
-- coluna de saída chamada "id" e, dentro do corpo, checam o gate com
-- "select habilitado from pcm.reconciliacao_outbox_gate where id". Em plpgsql, o "id" solto do
-- WHERE casa tanto com a variável de saída quanto com a coluna da tabela, e o Postgres recusa:
--
--   42702: column reference "id" is ambiguous
--
-- O erro acontece na PRIMEIRA linha executável, então as duas funções eram inalcançáveis em
-- qualquer chamada — gate aberto ou fechado, com ou sem permissão. A tela de conferência da fila
-- (apps/web/src/features/pcm/interfaces/reconciliacao/) nunca teria listado nada. O grant para
-- authenticated existe desde a migration 1839, o que confirma que o caminho era para estar vivo.
--
-- O mesmo defeito já tinha sido corrigido em pcm.sso_listar_os_reconciliacao pela migration 1030,
-- com exatamente esta solução: dar um alias à tabela do gate ("g") e qualificar "g.id". Estas
-- duas funções ficaram para trás porque nenhum teste as executava.
--
-- Só a linha do gate muda. Assinatura, permissões, projeção, paginação e isolamento por Cliente
-- (join contra pcm.sistemas/pcm.equipamentos, AC-7 de E01-S22 preservado: a UI nunca lê a outbox
-- direto) continuam idênticos. "create or replace function" preserva os GRANTs existentes.
--
-- Reverso: reaplicar o corpo anterior (com "where id") — que volta a quebrar com 42702, então o
-- reverso real é não reverter.

create or replace function pcm.sso_listar_outbox_reconciliacao(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,entidade text,objeto_id uuid,operacao text,estado text,estado_fonte text,tentativas integer,enfileirado_em timestamptz,enviado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.reconciliacao_outbox_gate g where g.id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then
    raise exception 'cliente_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
  return query select o.id,o.entity,o.row_id,o.op,
    case o.status when 'pending' then 'pendente' when 'processing' then 'incerto' when 'error' then 'incerto' else 'enviado_nao_confirmado' end,
    o.status,o.attempts,o.enqueued_at,o.sent_at
    from pcm.auvo_sync_outbox o
    where (p_apos is null or o.id>p_apos) and (
      (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
      (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id)))
    order by o.id limit p_limite;
end;
$$;

create or replace function pcm.sso_listar_outbox_reconciliacao_filtrada(p_cliente_id uuid,p_estado text,p_apos uuid,p_limite integer)
returns table(id uuid,entidade text,objeto_id uuid,operacao text,estado text,estado_fonte text,tentativas integer,enfileirado_em timestamptz,enviado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select g.habilitado from pcm.reconciliacao_outbox_gate g where g.id),false) then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or (p_estado is not null and p_estado not in ('pending','processing','error','sent')) then raise exception 'filtro_invalido' using errcode='22023'; end if;
  return query select o.id,o.entity,o.row_id,o.op,case o.status when 'pending' then 'pendente' when 'processing' then 'incerto' when 'error' then 'incerto' else 'enviado_nao_confirmado' end,
    o.status,o.attempts,o.enqueued_at,o.sent_at from pcm.auvo_sync_outbox o
    where (p_estado is null or o.status=p_estado) and (p_apos is null or o.id>p_apos) and (
      (o.entity='sistemas' and exists(select 1 from pcm.sistemas s where s.id=o.row_id and s.cliente_id=p_cliente_id)) or
      (o.entity='equipamentos' and exists(select 1 from pcm.equipamentos e where e.id=o.row_id and e.client_id=p_cliente_id)))
    order by o.id limit p_limite;
end $$;
