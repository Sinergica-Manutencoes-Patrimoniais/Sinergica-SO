-- 0068_E02-S08_timeline_service_role.sql — corrige autorização da timeline.
-- Em SECURITY DEFINER, current_user vira o dono da função; portanto não identifica service_role.
-- Reverso: restaurar a versão de 0047 (não recomendado: reabre a falha para chamadas internas).

create or replace function relacionamento.get_timeline_contato(
  p_contato_id uuid,
  p_limit int default 50
) returns table (
  evento_tipo text,
  entidade_tipo text,
  entidade_id uuid,
  titulo text,
  descricao text,
  ocorreu_em timestamptz,
  payload jsonb
)
language sql
stable
security definer
set search_path = relacionamento, atendimento, comercial, public
as $$
  with allowed as (
    select
      auth.role() = 'service_role'
      or current_setting('role', true) = 'service_role'
      or auth.jwt() ->> 'user_role' = 'superadmin'
      or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
      or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
      or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita') as ok
  )
  select *
  from (
    select
      'conversa'::text as evento_tipo,
      'atendimento.conversas'::text as entidade_tipo,
      c.id as entidade_id,
      coalesce(c.contato_nome, 'Conversa')::text as titulo,
      c.ultima_mensagem_preview::text as descricao,
      coalesce(c.ultima_mensagem_em, c.created_at) as ocorreu_em,
      jsonb_build_object(
        'canal', c.canal,
        'status', c.status,
        'client_id', c.client_id,
        'lead_id', c.lead_id
      ) as payload
    from atendimento.conversas c
    where c.contato_id = p_contato_id

    union all

    select
      'mensagem'::text,
      'atendimento.mensagens'::text,
      m.id,
      case m.direcao when 'entrada' then 'Mensagem recebida' else 'Mensagem enviada' end,
      left(coalesce(m.conteudo, ''), 240),
      m.created_at,
      jsonb_build_object(
        'direcao', m.direcao,
        'remetente_tipo', m.remetente_tipo,
        'status_entrega', m.status_entrega
      )
    from atendimento.mensagens m
    join atendimento.conversas c on c.id = m.conversa_id
    where c.contato_id = p_contato_id

    union all

    select
      'lead'::text,
      'comercial.leads'::text,
      l.id,
      coalesce(l.nome, 'Lead')::text,
      coalesce(l.resumo, l.origem, l.status)::text,
      l.created_at,
      jsonb_build_object(
        'status', l.status,
        'score', l.score,
        'origem', l.origem,
        'conversa_id', l.conversa_id
      )
    from comercial.leads l
    where l.contato_id = p_contato_id
  ) eventos
  where exists (select 1 from allowed where ok)
  order by ocorreu_em desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function relacionamento.get_timeline_contato(uuid, int) from public;
grant execute on function relacionamento.get_timeline_contato(uuid, int) to authenticated, service_role;
