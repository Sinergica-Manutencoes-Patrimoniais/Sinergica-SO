-- E01-S184: primeira etapa da proteção; não resolve permissões internas ou anexos.
-- Reverso operacional: restaurar definições das views 0188/0202 e remover policy
-- orcamentos_servico_cliente_bloqueio. Reversão reabre exposição: não aplicar sem avaliação.

create or replace function comercial.projecao_proposta_publica(p_payload jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'proposta', jsonb_strip_nulls(jsonb_build_object(
      'tipo', case when jsonb_typeof(p -> 'tipo') = 'string' then p -> 'tipo' end,
      'escopo', case when jsonb_typeof(p -> 'escopo') = 'string' then p -> 'escopo' end,
      'preco_centavos', case when jsonb_typeof(p -> 'preco_centavos') = 'number' then p -> 'preco_centavos' end,
      'valido_ate', case when jsonb_typeof(p -> 'valido_ate') = 'string' then p -> 'valido_ate' end,
      'versao_atual', case when jsonb_typeof(p -> 'versao_atual') = 'number' then p -> 'versao_atual' end
    )),
    'itens', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'descricao', case when jsonb_typeof(i -> 'descricao') = 'string' then i -> 'descricao' end,
      'quantidade', case when jsonb_typeof(i -> 'quantidade') = 'number' then i -> 'quantidade' end,
      'preco_venda_centavos', case when jsonb_typeof(i -> 'preco_venda_centavos') = 'number' then i -> 'preco_venda_centavos' end
    ))) from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'itens') = 'array' then p_payload -> 'itens' else '[]'::jsonb end) i), '[]'::jsonb)
  )
  from (select case when jsonb_typeof(p_payload -> 'proposta') = 'object' then p_payload -> 'proposta' else p_payload end as p) s;
$$;

create or replace view comercial.portal_propostas with (security_barrier = true) as
select p.id, p.oportunidade_id, o.cliente_id, p.tipo, p.status, p.escopo,
  p.preco_centavos, p.valido_ate, p.versao_atual, p.created_at,
  (select comercial.projecao_proposta_publica(v.payload) from comercial.proposta_versoes v
   where v.proposta_id = p.id and v.versao = p.versao_atual limit 1) as payload
from comercial.propostas p
join comercial.oportunidades o on o.id = p.oportunidade_id
where p.status in ('enviada', 'aceita', 'recusada')
  and exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
    where uc.user_id = auth.uid() and uc.cliente_id = o.cliente_id and u.ativo and u.papel = 'cliente-sindico');

drop policy if exists orcamentos_servico_cliente_bloqueio on pcm.orcamentos_servico;
create policy orcamentos_servico_cliente_bloqueio on pcm.orcamentos_servico as restrictive
  for select to authenticated using (coalesce(auth.jwt() ->> 'user_role', '') <> 'cliente-sindico');

alter view pcm.portal_orcamentos_servico set (security_invoker = false, security_barrier = true);
create or replace view pcm.portal_orcamentos_servico as
select o.id, o.cliente_id, o.requisicao_id, o.numero, o.titulo, o.descricao,
  coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'descricao', case when jsonb_typeof(i -> 'descricao') = 'string' then i -> 'descricao' end,
    'quantidade', case when jsonb_typeof(i -> 'quantidade') = 'number' then i -> 'quantidade' end,
    'valor_centavos', case when jsonb_typeof(i -> 'valor_centavos') = 'number' then i -> 'valor_centavos' end
  ))) from jsonb_array_elements(case when jsonb_typeof(o.itens) = 'array' then o.itens else '[]'::jsonb end) i), '[]'::jsonb) as itens,
  o.valor_total_centavos, o.status, o.valido_ate, o.ordem_servico_id, o.created_at
from pcm.orcamentos_servico o
where exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
  where uc.user_id = auth.uid() and uc.cliente_id = o.cliente_id and u.ativo and u.papel = 'cliente-sindico');
