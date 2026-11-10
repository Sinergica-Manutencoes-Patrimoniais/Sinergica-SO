-- E01-S184: não publicar valor de item legado cuja natureza de venda é desconhecida.
-- Reverso: restaurar definição da view de 0230 (reabre risco de exposição de valor interno).
create or replace view pcm.portal_orcamentos_servico as
select o.id, o.cliente_id, o.requisicao_id, o.numero, o.titulo, o.descricao,
  coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'descricao', case when jsonb_typeof(i -> 'descricao') = 'string' then i -> 'descricao' end,
    'quantidade', case when jsonb_typeof(i -> 'quantidade') = 'number' then i -> 'quantidade' end
  ))) from jsonb_array_elements(case when jsonb_typeof(o.itens) = 'array' then o.itens else '[]'::jsonb end) i), '[]'::jsonb) as itens,
  o.valor_total_centavos, o.status, o.valido_ate, o.ordem_servico_id, o.created_at
from pcm.orcamentos_servico o
where exists (select 1 from config.usuario_cliente uc join config.usuarios u on u.user_id = uc.user_id
  where uc.user_id = auth.uid() and uc.cliente_id = o.cliente_id and u.ativo and u.papel = 'cliente-sindico');
